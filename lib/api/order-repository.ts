import "server-only";
import { prisma } from "@/lib/db";
import { recordAudit } from "./audit";
import { diffFields, type AuditValue } from "./audit-diff";
import { classifyDiscount, DIRECTOR_DISCOUNT_LIMIT } from "./discount-policy";
import { SELLER_PAGE_SIZE } from "./inquiry-board-repository";
import { applyDiscount, subtotalOf } from "./order-money";
import { nextOrderNumber } from "./order-number";
import { canTransition, isEditable } from "./order-status";
import {
  customerReadScope,
  inquiryReadScope,
  isDirector,
  orderReadScope,
  orderWriteScope,
  type ScopeActor,
} from "./seller-scope";
import type {
  DiscountRequestInput,
  OrderCreateInput,
  OrderItemInput,
  OrderListQuery,
  OrderUpdateInput,
} from "@/lib/schemas";
import type { Prisma } from "@/prisma/generated/prisma/client";
import type { DiscountStatus, OrderStatus } from "@/prisma/generated/prisma/enums";

/**
 * Manual order entry, its lifecycle, and the discount path.
 *
 * Nothing here writes `Product.stock`. The director's product editor stays the
 * only writer, which is what keeps the derived `stockStatus` column from
 * drifting away from the numbers it describes.
 */

/** How many times a reference collision is retried before the write fails. */
const ORDER_NUMBER_ATTEMPTS = 3;

export interface OrderLineRow {
  id: string;
  productId: string;
  productSku: string;
  productName: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface OrderRow {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  sellerId: string;
  sellerName: string;
  status: OrderStatus;
  currency: string;
  subtotal: number;
  discountRequestedPercent: number;
  discountApprovedPercent: number;
  totalAmount: number;
  notes: string | null;
  inquiryId: string | null;
  itemCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderDiscountRow {
  id: string;
  requestedPercent: number;
  reason: string | null;
  status: DiscountStatus;
  decisionNote: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
}

export interface OrderDetail extends OrderRow {
  items: OrderLineRow[];
  /** So the seller knows whether they are waiting, approved, or rejected. */
  discountRequests: OrderDiscountRow[];
}

export interface OrderPage {
  items: OrderRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const ROW_SELECT = {
  id: true,
  orderNumber: true,
  customerId: true,
  sellerId: true,
  status: true,
  currency: true,
  subtotal: true,
  discountRequestedPercent: true,
  discountApprovedPercent: true,
  totalAmount: true,
  notes: true,
  inquiryId: true,
  createdAt: true,
  updatedAt: true,
  customer: { select: { name: true } },
  seller: { select: { name: true } },
  _count: { select: { items: true } },
} satisfies Prisma.OrderSelect;

type OrderRecord = Prisma.OrderGetPayload<{ select: typeof ROW_SELECT }>;

function toRow(row: OrderRecord): OrderRow {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    customerId: row.customerId,
    customerName: row.customer.name,
    sellerId: row.sellerId,
    sellerName: row.seller.name,
    status: row.status,
    currency: row.currency,
    subtotal: Number(row.subtotal),
    discountRequestedPercent: Number(row.discountRequestedPercent),
    discountApprovedPercent: Number(row.discountApprovedPercent),
    totalAmount: Number(row.totalAmount),
    notes: row.notes,
    inquiryId: row.inquiryId,
    itemCount: row._count.items,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listOrders(actor: ScopeActor, query: OrderListQuery): Promise<OrderPage> {
  const filters: Prisma.OrderWhereInput[] = [orderReadScope(actor)];

  if (query.status) {
    filters.push({ status: query.status });
  }
  if (query.customerId) {
    filters.push({ customerId: query.customerId });
  }

  const where: Prisma.OrderWhereInput = { AND: filters };

  const total = await prisma.order.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / SELLER_PAGE_SIZE));
  const page = Math.min(Math.max(1, query.page), totalPages);

  const rows = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * SELLER_PAGE_SIZE,
    take: SELLER_PAGE_SIZE,
    select: ROW_SELECT,
  });

  return { items: rows.map(toRow), total, page, pageSize: SELLER_PAGE_SIZE, totalPages };
}

export async function getOrder(id: string, actor: ScopeActor): Promise<OrderDetail | null> {
  const row = await prisma.order.findFirst({
    where: { id, ...orderReadScope(actor) },
    select: {
      ...ROW_SELECT,
      items: {
        select: {
          id: true,
          productId: true,
          productSku: true,
          productName: true,
          qty: true,
          unitPrice: true,
        },
      },
      discountRequests: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          requestedPercent: true,
          reason: true,
          status: true,
          decisionNote: true,
          createdAt: true,
          reviewedAt: true,
        },
      },
    },
  });

  if (row === null) {
    return null;
  }

  return {
    ...toRow(row),
    items: row.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productSku: item.productSku,
      productName: item.productName,
      qty: item.qty,
      unitPrice: Number(item.unitPrice),
      lineTotal: Number(item.unitPrice) * item.qty,
    })),
    discountRequests: row.discountRequests.map((request) => ({
      id: request.id,
      requestedPercent: Number(request.requestedPercent),
      reason: request.reason,
      status: request.status,
      decisionNote: request.decisionNote,
      createdAt: request.createdAt,
      reviewedAt: request.reviewedAt,
    })),
  };
}

export type OrderWriteResult =
  | { ok: true; id: string }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "customer_not_found" }
  | { ok: false; reason: "inquiry_not_found" }
  | { ok: false; reason: "product_not_found"; productId: string }
  | { ok: false; reason: "price_required"; productId: string }
  | {
      ok: false;
      reason: "insufficient_stock";
      productId: string;
      productName: string;
      requested: number;
      available: number;
    }
  | { ok: false; reason: "locked" }
  | { ok: false; reason: "illegal_transition"; from: OrderStatus; to: OrderStatus }
  | { ok: false; reason: "number_conflict" };

interface BuiltLine {
  productId: string;
  productSku: string;
  productName: string;
  qty: number;
  unitPrice: number;
}

type LineResult =
  | { ok: true; lines: BuiltLine[] }
  | Extract<
      OrderWriteResult,
      { reason: "product_not_found" | "price_required" | "insufficient_stock" }
    >;

/**
 * Turns requested lines into stored ones.
 *
 * `unitPrice` is snapshotted from the catalog rather than taken from the
 * caller. This is the rule that makes `User.discountLimit` mean anything: a
 * freely set line price lets a seller reach any total they like and routes
 * around the approval path entirely. A product priced on request is the one
 * exception — there is no catalog figure to copy, so one must be supplied.
 *
 * Stock is checked here rather than only in the browser. The order form warns
 * as the seller types, but that warning is advice a stale tab can miss: two
 * sellers can promise the same last three pumps within a minute of each other,
 * and only the write is in a position to refuse the second one. Quantities are
 * summed per product first, so two lines of the same part cannot each pass a
 * check the pair of them fails.
 */
async function buildLines(items: readonly OrderItemInput[]): Promise<LineResult> {
  const ids = [...new Set(items.map((item) => item.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: ids }, isActive: true },
    select: { id: true, sku: true, nameUz: true, price: true, stock: true },
  });
  const byId = new Map(products.map((product) => [product.id, product]));

  const lines: BuiltLine[] = [];

  for (const item of items) {
    const product = byId.get(item.productId);

    // A retired product is not sellable, so it reads the same as a missing one.
    if (product === undefined) {
      return { ok: false, reason: "product_not_found", productId: item.productId };
    }

    const catalogPrice = product.price === null ? null : Number(product.price);
    const unitPrice = catalogPrice ?? item.unitPrice ?? null;

    if (unitPrice === null) {
      return { ok: false, reason: "price_required", productId: item.productId };
    }

    lines.push({
      productId: product.id,
      productSku: product.sku,
      productName: product.nameUz,
      qty: item.qty,
      unitPrice,
    });
  }

  for (const [productId, requested] of totalQtyByProduct(lines)) {
    // Non-null: every line above came from a product found in `byId`.
    const product = byId.get(productId)!;

    if (requested > product.stock) {
      return {
        ok: false,
        reason: "insufficient_stock",
        productId,
        productName: product.nameUz,
        requested,
        available: product.stock,
      };
    }
  }

  return { ok: true, lines };
}

/** Two lines of the same part are one claim on the shelf, not two. */
function totalQtyByProduct(lines: readonly BuiltLine[]): Map<string, number> {
  const totals = new Map<string, number>();

  for (const line of lines) {
    totals.set(line.productId, (totals.get(line.productId) ?? 0) + line.qty);
  }

  return totals;
}

/** The highest reference issued this year, or null if none has been. */
async function latestOrderNumber(year: number): Promise<string | null> {
  const row = await prisma.order.findFirst({
    where: { orderNumber: { startsWith: "DP-" + year + "-" } },
    orderBy: { orderNumber: "desc" },
    select: { orderNumber: true },
  });

  return row?.orderNumber ?? null;
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string })?.code === "P2002";
}

export async function createOrder(
  input: OrderCreateInput,
  actor: ScopeActor,
): Promise<OrderWriteResult> {
  // A seller may raise an order for their own customer or for one still in the
  // pool; the pooled one becomes theirs below, because an order is a working
  // relationship and leaving the account unowned would strand it.
  const customer = await prisma.customer.findFirst({
    where: { id: input.customerId, ...customerReadScope(actor, { includePool: true }) },
    select: { id: true, assignedSellerId: true },
  });

  if (customer === null) {
    return { ok: false, reason: "customer_not_found" };
  }

  if (input.inquiryId) {
    const inquiry = await prisma.inquiry.findFirst({
      where: { id: input.inquiryId, ...inquiryReadScope(actor) },
      select: { id: true },
    });

    if (inquiry === null) {
      return { ok: false, reason: "inquiry_not_found" };
    }
  }

  const built = await buildLines(input.items);
  if (!built.ok) {
    return built;
  }

  const subtotal = subtotalOf(built.lines);
  const year = new Date().getFullYear();

  for (let attempt = 0; attempt < ORDER_NUMBER_ATTEMPTS; attempt += 1) {
    const orderNumber = nextOrderNumber(await latestOrderNumber(year), year);

    try {
      const created = await prisma.$transaction(async (tx) => {
        const order = await tx.order.create({
          data: {
            orderNumber,
            customerId: customer.id,
            sellerId: actor.id,
            subtotal,
            // No discount at creation: it is asked for separately, so every
            // reduction passes the ceiling check on its own way in.
            totalAmount: subtotal,
            notes: input.notes?.trim() || null,
            inquiryId: input.inquiryId ?? null,
            items: { create: built.lines },
          },
          select: { id: true, orderNumber: true, status: true },
        });

        if (customer.assignedSellerId === null && !isDirector(actor)) {
          await tx.customer.update({
            where: { id: customer.id },
            data: { assignedSellerId: actor.id },
          });
        }

        return order;
      });

      await recordAudit({
        userId: actor.id,
        action: "CREATE",
        entityType: "Order",
        entityId: created.id,
        after: {
          orderNumber: created.orderNumber,
          status: created.status,
          customerId: customer.id,
          subtotal,
          totalAmount: subtotal,
          itemCount: built.lines.length,
        },
      });

      return { ok: true, id: created.id };
    } catch (error) {
      // `orderNumber` is unique, so two sellers saving in the same second
      // collide here rather than producing two orders with one reference.
      if (!isUniqueViolation(error)) {
        throw error;
      }
    }
  }

  return { ok: false, reason: "number_conflict" };
}

function auditSnapshot(row: {
  status: OrderStatus;
  subtotal: unknown;
  totalAmount: unknown;
  notes: string | null;
  itemCount: number;
}): Record<string, AuditValue> {
  return {
    status: row.status,
    subtotal: Number(row.subtotal),
    totalAmount: Number(row.totalAmount),
    notes: row.notes,
    itemCount: row.itemCount,
  };
}

/**
 * Moves the order along, re-lines it, or both.
 *
 * Items and notes are editable in DRAFT and PENDING only: from CONFIRMED on,
 * the order is the record of an agreement and only its status may still move.
 * Every transition lands in the audit trail, which is the control the whole
 * seller-driven lifecycle rests on.
 */
export async function updateOrder(
  id: string,
  input: OrderUpdateInput,
  actor: ScopeActor,
): Promise<OrderWriteResult> {
  const before = await prisma.order.findFirst({
    where: { id, ...orderWriteScope(actor) },
    select: {
      id: true,
      status: true,
      subtotal: true,
      totalAmount: true,
      notes: true,
      discountApprovedPercent: true,
      _count: { select: { items: true } },
    },
  });

  if (before === null) {
    return { ok: false, reason: "not_found" };
  }

  const editsContent = input.items !== undefined || input.notes !== undefined;

  if (editsContent && !isEditable(before.status)) {
    return { ok: false, reason: "locked" };
  }

  if (input.status !== undefined && !canTransition(before.status, input.status)) {
    return { ok: false, reason: "illegal_transition", from: before.status, to: input.status };
  }

  const data: Prisma.OrderUpdateInput = {};

  if (input.status !== undefined) {
    data.status = input.status;
  }
  if (input.notes !== undefined) {
    data.notes = input.notes?.trim() || null;
  }

  let lines: BuiltLine[] | null = null;

  if (input.items !== undefined) {
    const built = await buildLines(input.items);
    if (!built.ok) {
      return built;
    }

    lines = built.lines;
    const subtotal = subtotalOf(lines);
    data.subtotal = subtotal;
    // The approved percent survives a re-line; the total it produces cannot.
    data.totalAmount = applyDiscount(subtotal, Number(before.discountApprovedPercent));
  }

  const after = await prisma.$transaction(async (tx) => {
    if (lines !== null) {
      // Replaced wholesale rather than reconciled: a line carries only
      // snapshots, so there is no per-row history to preserve.
      await tx.orderItem.deleteMany({ where: { orderId: id } });
      await tx.orderItem.createMany({
        data: lines.map((line) => ({ ...line, orderId: id })),
      });
    }

    return tx.order.update({
      where: { id },
      data,
      select: {
        status: true,
        subtotal: true,
        totalAmount: true,
        notes: true,
        _count: { select: { items: true } },
      },
    });
  });

  const diff = diffFields(
    auditSnapshot({ ...before, itemCount: before._count.items }),
    auditSnapshot({ ...after, itemCount: after._count.items }),
  );

  if (diff !== null) {
    await recordAudit({
      userId: actor.id,
      action: "UPDATE",
      entityType: "Order",
      entityId: id,
      before: diff.before,
      after: diff.after,
    });
  }

  return { ok: true, id };
}

export interface DiscountActor extends ScopeActor {
  /** Percent this account may discount without asking a director. */
  discountLimit: number;
}

export type OrderDiscountResult =
  | { ok: true; kind: "immediate"; totalAmount: number }
  | { ok: true; kind: "needs_approval"; requestId: string }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "locked" }
  | { ok: false; reason: "pending_exists" };

/**
 * Applies a discount, or asks for one.
 *
 * Inside the seller's own ceiling both percents are written and the total is
 * recomputed in a single write. Above it, only the requested percent is
 * recorded and a PENDING `DiscountRequest` goes to the director's existing
 * queue — the order keeps quoting the total the seller may actually honour
 * until an answer comes back.
 */
export async function requestOrderDiscount(
  id: string,
  input: DiscountRequestInput,
  actor: DiscountActor,
): Promise<OrderDiscountResult> {
  const order = await prisma.order.findFirst({
    where: { id, ...orderWriteScope(actor) },
    select: {
      id: true,
      status: true,
      subtotal: true,
      discountRequestedPercent: true,
      discountApprovedPercent: true,
    },
  });

  if (order === null) {
    return { ok: false, reason: "not_found" };
  }

  if (!isEditable(order.status)) {
    return { ok: false, reason: "locked" };
  }

  const subtotal = Number(order.subtotal);
  const percent = input.percent;
  const limit = isDirector(actor) ? DIRECTOR_DISCOUNT_LIMIT : actor.discountLimit;

  if (classifyDiscount(percent, limit).kind === "immediate") {
    const totalAmount = applyDiscount(subtotal, percent);

    await prisma.order.update({
      where: { id },
      data: {
        discountRequestedPercent: percent,
        discountApprovedPercent: percent,
        totalAmount,
      },
    });

    await recordAudit({
      userId: actor.id,
      action: "UPDATE",
      entityType: "Order",
      entityId: id,
      before: {
        discountApprovedPercent: Number(order.discountApprovedPercent),
        totalAmount: applyDiscount(subtotal, Number(order.discountApprovedPercent)),
      },
      after: { discountApprovedPercent: percent, totalAmount },
    });

    return { ok: true, kind: "immediate", totalAmount };
  }

  // One open request per order. A second would give the director two percents
  // to answer for the same total and no way to tell which one is current.
  const pending = await prisma.discountRequest.findFirst({
    where: { orderId: id, status: "PENDING" },
    select: { id: true },
  });

  if (pending !== null) {
    return { ok: false, reason: "pending_exists" };
  }

  const directors = await prisma.user.findMany({
    where: { role: "DIRECTOR", isActive: true },
    select: { id: true },
  });

  const created = await prisma.$transaction(async (tx) => {
    const request = await tx.discountRequest.create({
      data: {
        orderId: id,
        sellerId: actor.id,
        requestedPercent: percent,
        reason: input.reason?.trim() || null,
      },
      select: { id: true },
    });

    // The approved percent is deliberately untouched: until a director answers,
    // the order still totals what the seller may actually honour.
    await tx.order.update({
      where: { id },
      data: { discountRequestedPercent: percent },
    });

    if (directors.length > 0) {
      await tx.notification.createMany({
        data: directors.map((director) => ({
          userId: director.id,
          type: "DISCOUNT_REQUESTED" as const,
          entityId: id,
          message: percent + "% chegirma so'raldi.",
        })),
      });
    }

    return request;
  });

  await recordAudit({
    userId: actor.id,
    action: "CREATE",
    entityType: "DiscountRequest",
    entityId: created.id,
    after: { orderId: id, requestedPercent: percent, status: "PENDING", sellerLimit: limit },
  });

  return { ok: true, kind: "needs_approval", requestId: created.id };
}
