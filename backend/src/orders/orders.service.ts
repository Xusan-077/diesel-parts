import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { ProductsService } from '../products/products.service';
import { AuditService } from '../audit/audit.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { QueryOrderDto } from './dto/query-order.dto';
import { RequestDiscountDto } from './dto/request-discount.dto';
import { paginationMeta } from '../common/dto/pagination.dto';
import { assertOrderVisible } from '../common/order-access';
import {
  customerReadScope,
  inquiryReadScope,
  isDirector,
} from '../common/scope';
import { diffFields, type AuditValue } from '../common/audit-diff';
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
  seller: {
    select: {
      id: true,
      user: { select: { id: true, name: true, phone: true } },
    },
  },
  warehouse: { select: { id: true, name: true } },
  items: {
    include: { product: { select: { id: true, sku: true, nameEn: true } } },
  },
  payments: true,
  invoice: true,
} as const;

const DISCOUNT_REQUEST_SELECT = {
  id: true,
  requestedPercent: true,
  reason: true,
  status: true,
  decisionNote: true,
  createdAt: true,
  reviewedAt: true,
} as const;

interface BuiltOrderLine {
  productId: string;
  productSku: string;
  productName: string;
  qty: number;
  unitPrice: Prisma.Decimal;
}

type RequestDiscountResult =
  | { kind: 'immediate'; totalAmount: number }
  | { kind: 'needs_approval'; requestId: string };

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly products: ProductsService,
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
      include: {
        ...ORDER_INCLUDE,
        discountRequests: {
          orderBy: { createdAt: 'desc' },
          select: DISCOUNT_REQUEST_SELECT,
        },
      },
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
    // Root CRM orders have no warehouse concept, and a migrated seller has
    // `warehouseId: null` (plan Task 10). `Order.warehouseId` is nullable, and
    // `updateStatus` guards it at CONFIRMED time via `requireWarehouseId`, so a
    // CRM order raised without one is allowed rather than rejected here.
    const warehouseId = dto.warehouseId ?? seller.warehouseId ?? null;

    const scopeActor = { id: actor.id, role: actor.role };

    // A seller may raise an order for their own customer or for one still in
    // the pool; the pooled one becomes theirs below.
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: dto.customerId,
        ...customerReadScope(scopeActor, { includePool: true }),
      },
      select: { id: true, assignedSellerId: true },
    });
    if (!customer) {
      throw new NotFoundException({
        error: 'customer_not_found',
        message: 'Mijoz topilmadi',
      });
    }

    if (dto.inquiryId) {
      const inquiry = await this.prisma.inquiry.findFirst({
        where: { id: dto.inquiryId, ...inquiryReadScope(scopeActor) },
        select: { id: true },
      });
      if (!inquiry) {
        throw new BadRequestException({
          error: 'inquiry_not_found',
          message: "So'rov topilmadi",
        });
      }
    }

    const { lines, subtotal } = await this.buildOrderLines(dto.items);

    // The flat-amount discount / delivery fee are the POS quick-sale path,
    // untouched; a CRM order sends neither and totals exactly the subtotal.
    const discount = new Prisma.Decimal(dto.discount ?? 0);
    const deliveryFee = new Prisma.Decimal(dto.deliveryFee ?? 0);
    const total = subtotal.sub(discount).add(deliveryFee);
    if (total.isNegative()) {
      throw new BadRequestException(
        'Discount cannot exceed subtotal plus delivery fee',
      );
    }

    const notes = dto.notes?.trim() || null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const orderNumber = await this.reserveOrderNumber();

      try {
        const created = await this.prisma.$transaction(async (tx) => {
          const order = await tx.order.create({
            data: {
              orderNumber,
              customerId: customer.id,
              sellerId: actor.sellerId!,
              warehouseId,
              status: OrderStatus.PENDING,
              subtotal,
              discount,
              deliveryFee,
              totalAmount: total,
              notes,
              inquiryId: dto.inquiryId ?? null,
              items: { create: lines },
            },
            include: ORDER_INCLUDE,
          });

          if (customer.assignedSellerId === null && !isDirector(scopeActor)) {
            await tx.customer.update({
              where: { id: customer.id },
              data: { assignedSellerId: actor.id },
            });
          }

          return order;
        });

        await this.audit.record({
          userId: actor.id,
          action: AuditAction.CREATE,
          entityType: 'Order',
          entityId: created.id,
          after: {
            orderNumber: created.orderNumber,
            customerId: created.customerId,
            status: created.status,
            total: Number(created.totalAmount),
          },
        });

        return created;
      } catch (error) {
        // `orderNumber` is unique; a real collision is near-impossible because
        // `reserveOrderNumber` increments atomically, but the retry keeps the
        // typed `number_conflict` refusal reachable.
        if ((error as { code?: string })?.code !== 'P2002') {
          throw error;
        }
      }
    }

    throw new ConflictException({
      error: 'number_conflict',
      message: "Buyurtma raqami band bo'lib qoldi",
    });
  }

  /**
   * Re-lines an order, edits its notes, moves its status, or any combination.
   *
   * Items and notes are editable in DRAFT and NEW only: from CONFIRMED on the
   * order is the record of an agreement and only its status may still move. A
   * status change that needs inventory side effects is delegated to
   * `updateStatus` so reservation/fulfilment/release is stated once.
   */
  async update(actor: AuthenticatedUser, id: string, dto: UpdateOrderDto) {
    const existing = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!existing) {
      throw new NotFoundException({
        error: 'not_found',
        message: 'Order not found',
      });
    }
    assertOrderVisible(actor, existing.sellerId);

    const editsContent = dto.items !== undefined || dto.notes !== undefined;
    const editable =
      existing.status === OrderStatus.DRAFT ||
      existing.status === OrderStatus.PENDING;
    if (editsContent && !editable) {
      throw new ConflictException({
        error: 'locked',
        message: "Tasdiqlangan buyurtmaning tarkibi o'zgartirilmaydi",
      });
    }

    const wantsStatusChange =
      dto.status !== undefined && dto.status !== existing.status;
    if (wantsStatusChange && !canTransition(existing.status, dto.status!)) {
      throw new ConflictException({
        error: 'illegal_transition',
        from: existing.status,
        to: dto.status,
        message: `Cannot move an order from ${existing.status} to ${dto.status}`,
      });
    }

    // `status` is deliberately not in this diff set: a real transition is
    // delegated to `updateStatus`, which records its own `{status}` before/after
    // `UPDATE` audit row. Recording it again here would double every
    // order-status event in the activity trail.
    const before: Record<string, AuditValue> = {
      subtotal: Number(existing.subtotal),
      total: Number(existing.totalAmount),
      notes: existing.notes,
      itemCount: existing.items.length,
    };

    const data: Prisma.OrderUpdateInput = {};
    if (dto.notes !== undefined) {
      data.notes = dto.notes?.trim() || null;
    }

    let rebuiltLines: BuiltOrderLine[] | null = null;
    if (dto.items !== undefined) {
      const built = await this.buildOrderLines(dto.items);
      rebuiltLines = built.lines;
      data.subtotal = built.subtotal;
      // The approved percent survives a re-line; the total it produces cannot.
      data.totalAmount = new Prisma.Decimal(
        applyDiscount(
          Number(built.subtotal),
          Number(existing.discountApprovedPercent),
        ),
      );
    }

    if (rebuiltLines !== null || Object.keys(data).length > 0) {
      await this.prisma.$transaction(async (tx) => {
        if (rebuiltLines !== null) {
          await tx.orderItem.deleteMany({ where: { orderId: id } });
          await tx.orderItem.createMany({
            data: rebuiltLines.map((line) => ({ ...line, orderId: id })),
          });
        }
        if (Object.keys(data).length > 0) {
          await tx.order.update({ where: { id }, data });
        }
      });
    }

    if (wantsStatusChange) {
      await this.updateStatus(actor, id, dto.status!);
    }

    const updated = await this.prisma.order.findUniqueOrThrow({
      where: { id },
      include: ORDER_INCLUDE,
    });

    const after: Record<string, AuditValue> = {
      subtotal: Number(updated.subtotal),
      total: Number(updated.totalAmount),
      notes: updated.notes,
      itemCount: updated.items.length,
    };

    const diff = diffFields(before, after);
    if (diff !== null) {
      await this.audit.record({
        userId: actor.id,
        action: AuditAction.UPDATE,
        entityType: 'Order',
        entityId: id,
        before: diff.before,
        after: diff.after,
      });
    }

    return updated;
  }

  /**
   * Turns requested lines into stored ones.
   *
   * `price` is snapshotted from the catalog rather than taken from the caller —
   * a freely set line price routes around `User.discountLimit` entirely. A
   * product priced on request is the one exception: there is no catalog figure
   * to copy, so one must be supplied. Stock is summed per product first, then
   * checked against computed availability, so two lines of the same part cannot
   * each pass a check the pair of them fails.
   */
  private async buildOrderLines(
    items: { productId: string; quantity: number; price?: number }[],
  ): Promise<{ lines: BuiltOrderLine[]; subtotal: Prisma.Decimal }> {
    const ids = [...new Set(items.map((item) => item.productId))];
    const products = await this.prisma.product.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        sku: true,
        nameEn: true,
        price: true,
        isActive: true,
      },
    });
    const byId = new Map(products.map((product) => [product.id, product]));

    const lines: BuiltOrderLine[] = [];

    for (const item of items) {
      const product = byId.get(item.productId);
      // A retired product is not sellable, so it reads the same as a missing one.
      if (!product || !product.isActive) {
        throw new BadRequestException({
          error: 'product_not_found',
          productId: item.productId,
          message: product
            ? `Product ${product.sku} is not active`
            : 'One or more products do not exist',
        });
      }

      let price: Prisma.Decimal;
      if (product.price !== null) {
        price = product.price;
      } else if (item.price !== undefined && item.price !== null) {
        price = new Prisma.Decimal(item.price);
      } else {
        throw new BadRequestException({
          error: 'price_required',
          productId: item.productId,
          message: `Product ${product.sku} has no catalog price and requires an explicit price`,
        });
      }

      lines.push({
        productId: product.id,
        productSku: product.sku,
        productName: product.nameEn,
        qty: item.quantity,
        unitPrice: price,
      });
    }

    // Two lines of the same part are one claim on the shelf, not two.
    const requestedByProduct = new Map<string, number>();
    for (const line of lines) {
      requestedByProduct.set(
        line.productId,
        (requestedByProduct.get(line.productId) ?? 0) + line.qty,
      );
    }

    for (const [productId, requested] of requestedByProduct) {
      const product = byId.get(productId)!;
      const { totals } = await this.products.stock(productId);
      const available = totals.availableQuantity;
      if (requested > available) {
        throw new ConflictException({
          error: 'insufficient_stock',
          productId,
          productName: product.nameEn,
          requested,
          available,
          message: `${product.nameEn} — ombnorda ${available} dona qoldi, so'ralgani ${requested} dona`,
        });
      }
    }

    const subtotal = lines.reduce(
      (sum, line) => sum.add(line.unitPrice.mul(line.qty)),
      new Prisma.Decimal(0),
    );

    return { lines, subtotal };
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

    const previousStatus = order.status;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (target === OrderStatus.CONFIRMED) {
        await this.inventory.reserveForOrder(
          tx,
          this.requireWarehouseId(order),
          order.items.map((i) => ({
            productId: i.productId,
            quantity: i.qty,
          })),
          actor.id,
        );
      } else if (target === OrderStatus.COMPLETED) {
        await this.inventory.fulfillForOrder(
          tx,
          this.requireWarehouseId(order),
          order.items.map((i) => ({
            productId: i.productId,
            quantity: i.qty,
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
            quantity: i.qty,
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

    await this.audit.record({
      userId: actor.id,
      action: AuditAction.UPDATE,
      entityType: 'Order',
      entityId: id,
      before: { status: previousStatus },
      after: { status: updated.status },
    });

    return updated;
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
   *
   * Returns a discriminated result so the two branches are distinguishable:
   * `{ kind: 'immediate', totalAmount }` for a within-ceiling approval,
   * `{ kind: 'needs_approval', requestId }` for a request that was queued.
   */
  async requestDiscount(
    actor: AuthenticatedUser,
    id: string,
    dto: RequestDiscountDto,
  ): Promise<RequestDiscountResult> {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    assertOrderVisible(actor, order.sellerId);

    // A settled or abandoned order is closed: neither has an outgoing
    // transition in order-status-transitions.ts's table, and a discount
    // touching `total` after settlement would silently rewrite a figure the
    // books already closed on.
    if (
      order.status === OrderStatus.COMPLETED ||
      order.status === OrderStatus.CANCELLED
    ) {
      throw new ConflictException({
        error: 'locked',
        message: 'Cannot request a discount on a completed or cancelled order',
      });
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
        total: Number(order.totalAmount),
      };

      await this.prisma.order.update({
        where: { id },
        data: {
          discountRequestedPercent: new Prisma.Decimal(percent),
          discountApprovedPercent: new Prisma.Decimal(percent),
          totalAmount: new Prisma.Decimal(total),
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

      return { kind: 'immediate', totalAmount: total };
    }

    // One open request per order. A second would give the director two
    // percents to answer for the same total and no way to tell which is
    // current.
    const pending = await this.prisma.discountRequest.findFirst({
      where: { orderId: id, status: DiscountStatus.PENDING },
      select: { id: true },
    });
    if (pending !== null) {
      throw new ConflictException({
        error: 'pending_exists',
        message: 'A discount request is already pending for this order',
      });
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

    return { kind: 'needs_approval', requestId: created.id };
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
    // Stock is reserved on entry to CONFIRMED and stays reserved through
    // PREPARING (step-2 enum value, restored in the transition table), so
    // cancelling from either state must release it.
    return status === OrderStatus.CONFIRMED || status === OrderStatus.PREPARING;
  }

  /**
   * Order.warehouseId is nullable (CRM orders may not have one until
   * confirmed - see the schema doc-comment). The existing POS creation flow
   * still always sets one up front; a CRM order raised without one trips this
   * guard at its first inventory-touching transition.
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
