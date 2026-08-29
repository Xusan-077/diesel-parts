import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { AuditService } from '../audit/audit.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrderDto } from './dto/query-order.dto';
import { RequestDiscountDto } from './dto/request-discount.dto';
import { paginationMeta } from '../common/dto/pagination.dto';
import { assertOrderVisible } from '../common/order-access';
import { isDirector } from '../common/scope';
import { canTransition } from './order-status-transitions';
import { applyDiscount } from '../discount-requests/order-money';
import {
  DIRECTOR_DISCOUNT_LIMIT,
  classifyDiscount,
} from '../discount-requests/discount-policy';
import {
  AuditAction,
  DiscountStatus,
  NotificationType,
  OrderStatus,
  Prisma,
  Role,
} from '../../generated/prisma/client';
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
    private readonly audit: AuditService,
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
   * Applies a discount, or asks a director for one.
   *
   * Ported from the root Next.js app's `lib/api/order-repository.ts`'s
   * `requestOrderDiscount`. Inside the seller's own `User.discountLimit`
   * (a director is bound by no ceiling — `DIRECTOR_DISCOUNT_LIMIT`), both
   * percents are written and the total is recomputed in one write. Above it,
   * only the requested percent is recorded and a PENDING `DiscountRequest`
   * goes to the director's queue: the order keeps quoting the total the
   * seller may actually honour until an answer comes back. Written directly
   * against `PrismaService` rather than through `DiscountRequestsService`
   * (which only owns listing/deciding an existing request, by its own
   * doc-comment) — reusing its pure `order-money`/`discount-policy` helpers
   * instead of duplicating the arithmetic.
   */
  async requestDiscount(
    actor: AuthenticatedUser,
    id: string,
    dto: RequestDiscountDto,
  ) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    assertOrderVisible(actor, order.sellerId);

    // A settled or abandoned order is closed: neither has an outgoing
    // transition in order-status-transitions.ts's table, and a discount
    // touching `total` after settlement would silently rewrite a figure the
    // books already closed on. This is narrower than root's `isEditable`
    // (which also gates in-progress CRM states) — those states are Task 10's
    // unresolved territory, not this method's to guess at.
    if (
      order.status === OrderStatus.COMPLETED ||
      order.status === OrderStatus.CANCELLED
    ) {
      throw new ConflictException(
        'Cannot request a discount on a completed or cancelled order',
      );
    }

    const percent = dto.percent;
    const limit = isDirector(actor)
      ? DIRECTOR_DISCOUNT_LIMIT
      : (
          await this.prisma.user.findUniqueOrThrow({
            where: { id: actor.id },
            select: { discountLimit: true },
          })
        ).discountLimit;

    const subtotal = Number(order.subtotal);

    if (classifyDiscount(percent, limit).kind === 'immediate') {
      const total = applyDiscount(subtotal, percent);
      const before = {
        discountApprovedPercent: Number(order.discountApprovedPercent),
        total: Number(order.total),
      };

      const updated = await this.prisma.order.update({
        where: { id },
        data: {
          discountRequestedPercent: new Prisma.Decimal(percent),
          discountApprovedPercent: new Prisma.Decimal(percent),
          total: new Prisma.Decimal(total),
        },
      });

      await this.audit.record({
        userId: actor.id,
        action: AuditAction.UPDATE,
        entityType: 'Order',
        entityId: id,
        before,
        after: { discountApprovedPercent: percent, total },
      });

      return updated;
    }

    // One open request per order. A second would give the director two
    // percents to answer for the same total and no way to tell which is
    // current.
    const pending = await this.prisma.discountRequest.findFirst({
      where: { orderId: id, status: DiscountStatus.PENDING },
      select: { id: true },
    });
    if (pending !== null) {
      throw new ConflictException(
        'A discount request is already pending for this order',
      );
    }

    const directors = await this.prisma.user.findMany({
      where: { role: Role.DIRECTOR, isActive: true },
      select: { id: true },
    });

    const created = await this.prisma.$transaction(async (tx) => {
      const request = await tx.discountRequest.create({
        data: {
          orderId: id,
          sellerId: actor.id,
          requestedPercent: new Prisma.Decimal(percent),
          reason: dto.reason?.trim() || null,
        },
      });

      // The approved percent is deliberately untouched: until a director
      // answers, the order still totals what the seller may actually honour.
      await tx.order.update({
        where: { id },
        data: { discountRequestedPercent: new Prisma.Decimal(percent) },
      });

      if (directors.length > 0) {
        await tx.notification.createMany({
          data: directors.map((director) => ({
            userId: director.id,
            type: NotificationType.DISCOUNT_REQUESTED,
            entityId: id,
            message: `${percent}% chegirma so'raldi.`,
          })),
        });
      }

      return request;
    });

    await this.audit.record({
      userId: actor.id,
      action: AuditAction.CREATE,
      entityType: 'DiscountRequest',
      entityId: created.id,
      after: {
        orderId: id,
        requestedPercent: percent,
        status: DiscountStatus.PENDING,
        sellerLimit: limit,
      },
    });

    return created;
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
