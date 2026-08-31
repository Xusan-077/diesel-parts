import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CartsService } from '../carts/carts.service';
import { CustomersService } from '../customers/customers.service';
import { OrdersService } from '../orders/orders.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { getOrCreateHouseSeller } from './house-seller';
import { buildPaymeCheckoutUrl, toTiyin } from '../payme/payme-money';
import { extractNationalDigits } from '../common/phone';
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

    const fullName = `${dto.firstName.trim()} ${dto.lastName.trim()}`.trim();

    const [customer, houseSeller, lines, orderNumber] = await Promise.all([
      this.customers.findOrCreateByPhone(phone, {
        name: fullName,
        email: dto.email,
        company: dto.companyName,
        taxId: dto.taxId,
      }),
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
        deliveryMethod: dto.deliveryMethod,
        deliveryCity:
          dto.deliveryMethod === 'DELIVERY' ? (dto.city ?? null) : null,
        deliveryDistrict:
          dto.deliveryMethod === 'DELIVERY' ? (dto.district ?? null) : null,
        deliveryStreet:
          dto.deliveryMethod === 'DELIVERY' ? (dto.street ?? null) : null,
        deliveryNotes: dto.deliveryNotes?.trim() || null,
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
          returnUrl: dto.returnBaseUrl
            ? `${dto.returnBaseUrl}/checkout/status/${order.id}`
            : undefined,
        });
      }
    }

    return { order, checkoutUrl };
  }

  /**
   * The payment-result page's polling target. Ownership is checked on
   * canonical phone digits — same rule as CustomersService.findOrCreateByPhone
   * — and a mismatch answers identically to a missing order, so a caller can
   * never learn that *some* order exists at an id that is not theirs.
   */
  async getOrderStatus(phone: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        payments: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    const national = extractNationalDigits(phone);
    if (!order || extractNationalDigits(order.customer.phone) !== national) {
      throw new NotFoundException('Order not found');
    }

    const latestPayment = order.payments[0] ?? null;

    return {
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      latestPaymentStatus: latestPayment?.status ?? null,
    };
  }
}
