import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrderDto } from './dto/query-order.dto';
import { paginationMeta } from '../common/dto/pagination.dto';
import { assertOrderVisible } from '../common/order-access';
import { canTransition } from './order-status-transitions';
import { OrderStatus, Prisma, Role } from '../../generated/prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';

const ORDER_INCLUDE = {
  customer: { select: { id: true, name: true, phone: true } },
  seller: { select: { id: true, user: { select: { id: true, phone: true } } } },
  warehouse: { select: { id: true, name: true } },
  items: {
    include: { product: { select: { id: true, sku: true, nameEn: true } } },
  },
  payments: true,
  invoice: true,
} as const;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  async findAll(actor: AuthenticatedUser, query: QueryOrderDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.OrderWhereInput = {};
    if (actor.role === Role.SELLER) {
      if (!actor.sellerId)
        throw new ForbiddenException('This account has no seller profile');
      where.sellerId = actor.sellerId;
    }
    if (query.status) where.status = query.status;
    if (query.customerId) where.customerId = query.customerId;
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
      };
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: ORDER_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return { data, meta: paginationMeta(page, limit, total) };
  }

  async findOne(actor: AuthenticatedUser, id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException('Order not found');
    assertOrderVisible(actor, order.sellerId);
    return order;
  }

  async create(actor: AuthenticatedUser, dto: CreateOrderDto) {
    if (!actor.sellerId) {
      throw new BadRequestException(
        'Only an account with a seller profile can create orders',
      );
    }

    const seller = await this.prisma.seller.findUniqueOrThrow({
      where: { id: actor.sellerId },
    });
    const warehouseId = dto.warehouseId ?? seller.warehouseId;
    if (!warehouseId) {
      throw new BadRequestException(
        'No warehouse specified and the seller has no default warehouse',
      );
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const productIds = dto.items.map((item) => item.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
    });
    if (products.length !== new Set(productIds).size) {
      throw new BadRequestException('One or more products do not exist');
    }
    const productById = new Map(products.map((p) => [p.id, p]));

    const discount = new Prisma.Decimal(dto.discount ?? 0);
    const deliveryFee = new Prisma.Decimal(dto.deliveryFee ?? 0);

    const lineItems = dto.items.map((item) => {
      const product = productById.get(item.productId)!;
      if (!product.isActive) {
        throw new BadRequestException(`Product ${product.sku} is not active`);
      }
      if (product.price === null) {
        throw new BadRequestException(
          `Product ${product.sku} has no catalog price and requires an explicit price`,
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

    const subtotal = lineItems.reduce(
      (sum, line) => sum.add(line.total),
      new Prisma.Decimal(0),
    );
    const total = subtotal.sub(discount).add(deliveryFee);
    if (total.isNegative()) {
      throw new BadRequestException(
        'Discount cannot exceed subtotal plus delivery fee',
      );
    }

    const orderNumber = await this.reserveOrderNumber();

    return this.prisma.$transaction(async (tx) => {
      return tx.order.create({
        data: {
          orderNumber,
          customerId: dto.customerId,
          sellerId: actor.sellerId!,
          warehouseId,
          status: OrderStatus.NEW,
          subtotal,
          discount,
          deliveryFee,
          total,
          items: { create: lineItems },
        },
        include: ORDER_INCLUDE,
      });
    });
  }

  async updateStatus(
    actor: AuthenticatedUser,
    id: string,
    target: OrderStatus,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    assertOrderVisible(actor, order.sellerId);

    if (!canTransition(order.status, target)) {
      throw new BadRequestException(
        `Cannot move an order from ${order.status} to ${target}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      if (target === OrderStatus.CONFIRMED) {
        await this.inventory.reserveForOrder(
          tx,
          this.requireWarehouseId(order),
          order.items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
          })),
          actor.id,
        );
      } else if (target === OrderStatus.COMPLETED) {
        await this.inventory.fulfillForOrder(
          tx,
          this.requireWarehouseId(order),
          order.items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
          })),
          actor.id,
        );
      } else if (
        target === OrderStatus.CANCELLED &&
        this.wasReserved(order.status)
      ) {
        await this.inventory.releaseForOrder(
          tx,
          this.requireWarehouseId(order),
          order.items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
          })),
          actor.id,
          'Order cancelled',
        );
      }

      return tx.order.update({
        where: { id },
        data: { status: target },
        include: ORDER_INCLUDE,
      });
    });
  }

  cancel(actor: AuthenticatedUser, id: string) {
    return this.updateStatus(actor, id, OrderStatus.CANCELLED);
  }

  /**
   * The next `DP-N` reference, atomically. Shared by the POS/CRM order form
   * (create, above) and CheckoutService — one sequence, one numbering
   * scheme, regardless of which flow raised the order.
   */
  async reserveOrderNumber(): Promise<string> {
    const sequence = await this.prisma.orderSequence.upsert({
      where: { id: 1 },
      create: { id: 1, lastNumber: 1001 },
      update: { lastNumber: { increment: 1 } },
    });
    return `DP-${sequence.lastNumber}`;
  }

  private wasReserved(status: OrderStatus) {
    return status === OrderStatus.CONFIRMED || status === OrderStatus.PREPARING;
  }

  /**
   * Order.warehouseId is nullable (CRM orders may not have one until
   * confirmed - see the schema doc-comment). The existing POS creation flow
   * still always sets one up front, so this guard should never trip today;
   * Task 10 replaces it with real warehouse-resolution logic for CRM orders
   * raised without one.
   */
  private requireWarehouseId(order: { warehouseId: string | null }): string {
    if (!order.warehouseId) {
      throw new BadRequestException(
        'Order has no warehouse assigned; a warehouse must be resolved before this transition',
      );
    }
    return order.warehouseId;
  }
}
