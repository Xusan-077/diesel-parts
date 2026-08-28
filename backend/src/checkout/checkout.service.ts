import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CartsService } from '../carts/carts.service';
import { CustomersService } from '../customers/customers.service';
import { OrdersService } from '../orders/orders.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { getOrCreateHouseSeller } from './house-seller';
import { buildPaymeCheckoutUrl, toTiyin } from '../payme/payme-money';
import {
  Prisma,
  PaymentMethod,
  PaymentStatus,
} from '../../generated/prisma/client';

interface OrderLine {
  productId: string;
  productSku: string;
  productName: string;
  quantity: number;
  price: Prisma.Decimal;
  total: Prisma.Decimal;
}

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly carts: CartsService,
    private readonly customers: CustomersService,
    private readonly orders: OrdersService,
    private readonly config?: ConfigService,
  ) {}

  private async buildLines(
    items: readonly { productId: string; quantity: number }[],
  ): Promise<OrderLine[]> {
    const productIds = items.map((item) => item.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
    });
    const byId = new Map(products.map((product) => [product.id, product]));

    return items.map((item) => {
      const product = byId.get(item.productId);
      if (!product) {
        throw new BadRequestException(
          `Product ${item.productId} is no longer available`,
        );
      }
      if (product.price === null) {
        throw new BadRequestException(
          `Product ${product.sku} has no catalog price and cannot be bought online`,
        );
      }
      const price = product.price;
      const total = price.mul(item.quantity);
      return {
        productId: product.id,
        productSku: product.sku,
        productName: product.nameEn,
        quantity: item.quantity,
        price,
        total,
      };
    });
  }

  async createOrder(phone: string, dto: CreateCheckoutDto) {
    const cart = await this.carts.getCart(phone);
    if (cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    const [customer, houseSeller, lines, orderNumber] = await Promise.all([
      this.customers.findOrCreateByPhone(phone),
      getOrCreateHouseSeller(this.prisma),
      this.buildLines(cart.items),
      this.orders.reserveOrderNumber(),
    ]);

    const subtotal = lines.reduce(
      (sum, line) => sum.add(line.total),
      new Prisma.Decimal(0),
    );
    // Always 0, never client-supplied: a caller-set fee let a shopper zero out
    // what should be a real delivery charge, since Order.total (this sum) is
    // exactly what Payme is told to collect. Revisit once a real delivery-fee
    // calculation (method/zone -> price) exists to validate a client value against.
    const deliveryFee = new Prisma.Decimal(0);
    const total = subtotal.add(deliveryFee);

    const order = await this.prisma.order.create({
      data: {
        orderNumber,
        customerId: customer.id,
        sellerId: houseSeller.id,
        // Left null on purpose: a self-checkout order doesn't pick a
        // warehouse up front, same as the CRM board flow the abandoned
        // consolidation plan anticipated (see house-seller.ts's comment).
        // A staff member confirms the order — and resolves a warehouse —
        // through the existing admin flow; that's out of this plan's scope.
        warehouseId: null,
        subtotal,
        deliveryFee,
        total,
        notes: dto.notes?.trim() || null,
        items: {
          create: lines.map(({ price, total: lineTotal, ...rest }) => ({
            ...rest,
            price,
            total: lineTotal,
          })),
        },
      },
    });

    await this.carts.clear(phone);

    let checkoutUrl: string | null = null;
    if (dto.paymentMethod === 'ONLINE') {
      await this.prisma.payment.create({
        data: {
          orderId: order.id,
          amount: total,
          method: PaymentMethod.ONLINE,
          status: PaymentStatus.PENDING,
          provider: 'payme',
        },
      });

      const merchantId = this.config?.get<string>('PAYME_MERCHANT_ID');
      if (merchantId) {
        checkoutUrl = buildPaymeCheckoutUrl({
          merchantId,
          orderId: order.id,
          amountTiyin: toTiyin(total),
        });
      }
    }

    return { order, checkoutUrl };
  }
}
