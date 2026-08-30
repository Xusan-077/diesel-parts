import "server-only";
import { BackendApiError, backendRequest } from "./backend-client";
import { getStaffSession } from "@/lib/auth/staff-session";
import type { ScopeActor } from "./seller-scope";
import type {
  DiscountRequestInput,
  OrderCreateInput,
  OrderListQuery,
  OrderUpdateInput,
} from "@/lib/schemas";
import type { DiscountStatus, OrderStatus } from "@/prisma/generated/prisma/enums";

/**
 * Manual order entry, its lifecycle, and the discount path.
 *
 * Every read and write goes to backend/'s `seller/orders`, which owns line
 * building, stock, numbering, the transition table and the audit trail. This
 * module only translates between the root contract (root `OrderStatus` enum,
 * money as `number`) and the wire shape (backend status names, `Decimal`
 * serialised as a JSON string).
 */

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

/* -------------------------------------------------------------------------- */
/*  Wire shapes — backend/'s `ORDER_INCLUDE` payload                          */
/* -------------------------------------------------------------------------- */

interface BackendOrderItem {
  id: string;
  productId: string;
  productSku: string;
  productName: string;
  quantity: number;
  price: string;
  total: string;
}

interface BackendDiscountRequest {
  id: string;
  requestedPercent: string;
  reason: string | null;
  status: string;
  decisionNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

interface BackendOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  sellerId: string;
  status: string;
  currency: string;
  subtotal: string;
  discountRequestedPercent: string;
  discountApprovedPercent: string;
  total: string;
  notes: string | null;
  inquiryId: string | null;
  createdAt: string;
  updatedAt: string;
  customer: { id: string; name: string; phone: string };
  seller: { id: string; user: { id: string; name: string; phone: string | null } };
  items: BackendOrderItem[];
  discountRequests?: BackendDiscountRequest[];
}

interface BackendOrderPage {
  data: BackendOrder[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

/* -------------------------------------------------------------------------- */
/*  Status translation                                                       */
/* -------------------------------------------------------------------------- */

/** backend status -> root status (reads). */
function toRootStatus(s: string): OrderStatus {
  if (s === "NEW") return "PENDING";
  if (s === "PREPARING") return "CONFIRMED";
  return s as OrderStatus; // DRAFT, CONFIRMED, COMPLETED, CANCELLED pass through
}

/** root status -> backend status (writes / query filter). */
function toBackendStatus(s: OrderStatus): string {
  return s === "PENDING" ? "NEW" : s;
}

/* -------------------------------------------------------------------------- */
/*  Mapping                                                                  */
/* -------------------------------------------------------------------------- */

async function accessToken(): Promise<string | undefined> {
  const session = await getStaffSession();
  return session?.accessToken;
}

function toRow(o: BackendOrder): OrderRow {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    customerId: o.customerId,
    customerName: o.customer.name,
    sellerId: o.sellerId,
    sellerName: o.seller.user.name,
    status: toRootStatus(o.status),
    currency: o.currency,
    subtotal: Number(o.subtotal),
    discountRequestedPercent: Number(o.discountRequestedPercent),
    discountApprovedPercent: Number(o.discountApprovedPercent),
    totalAmount: Number(o.total),
    notes: o.notes,
    inquiryId: o.inquiryId,
    itemCount: o.items.length,
    createdAt: new Date(o.createdAt),
    updatedAt: new Date(o.updatedAt),
  };
}

function toLine(it: BackendOrderItem): OrderLineRow {
  return {
    id: it.id,
    productId: it.productId,
    productSku: it.productSku,
    productName: it.productName,
    qty: it.quantity,
    unitPrice: Number(it.price),
    lineTotal: Number(it.total),
  };
}

function toDiscountRow(d: BackendDiscountRequest): OrderDiscountRow {
  return {
    id: d.id,
    requestedPercent: Number(d.requestedPercent),
    reason: d.reason,
    status: d.status as DiscountStatus,
    decisionNote: d.decisionNote,
    createdAt: new Date(d.createdAt),
    reviewedAt: d.reviewedAt ? new Date(d.reviewedAt) : null,
  };
}

/**
 * The line-building refusals `createOrder` and `updateOrder` map identically —
 * backend/ builds lines the same way for a create and a re-line. Returns
 * `null` when the failure is not one of these three, so the caller can carry on
 * to its own cases or rethrow.
 */
function lineBuildFailure(
  error: BackendApiError,
): Extract<
  OrderWriteResult,
  { reason: "product_not_found" | "price_required" | "insufficient_stock" }
> | null {
  const body = (error.body ?? {}) as {
    productId?: string;
    productName?: string;
    requested?: number;
    available?: number;
  };

  switch (error.code) {
    case "insufficient_stock":
      return {
        ok: false,
        reason: "insufficient_stock",
        productId: body.productId ?? "",
        productName: body.productName ?? "",
        requested: body.requested ?? 0,
        available: body.available ?? 0,
      };
    case "price_required":
      return { ok: false, reason: "price_required", productId: body.productId ?? "" };
    case "product_not_found":
      return { ok: false, reason: "product_not_found", productId: body.productId ?? "" };
    default:
      return null;
  }
}

/* -------------------------------------------------------------------------- */
/*  Public API                                                               */
/* -------------------------------------------------------------------------- */

/**
 * `_actor` is not sent to backend/: `seller/orders` scopes every read and write
 * from the caller's own access token via `@CurrentUser()`, never a
 * client-supplied actor object (the parameter stays here only because every
 * caller already has one to hand — see `lib/api/customer-repository.ts`'s
 * identical `_actor` doc comment).
 */
export async function listOrders(
  _actor: ScopeActor,
  query: OrderListQuery,
): Promise<OrderPage> {
  const result = await backendRequest<BackendOrderPage>("/seller/orders", {
    accessToken: await accessToken(),
    query: {
      status: query.status ? toBackendStatus(query.status) : undefined,
      customerId: query.customerId,
      page: query.page,
    },
  });

  return {
    items: result.data.map(toRow),
    total: result.meta.total,
    page: result.meta.page,
    pageSize: result.meta.limit,
    totalPages: result.meta.totalPages,
  };
}

export async function getOrder(id: string, _actor: ScopeActor): Promise<OrderDetail | null> {
  try {
    const o = await backendRequest<BackendOrder>(`/seller/orders/${id}`, {
      accessToken: await accessToken(),
    });

    return {
      ...toRow(o),
      items: o.items.map(toLine),
      discountRequests: (o.discountRequests ?? []).map(toDiscountRow),
    };
  } catch (error) {
    // 404 (missing) and 403 (another seller's order) both read as "not there":
    // root's `orderReadScope` made it invisible, it did not forbid it.
    if (
      error instanceof BackendApiError &&
      (error.status === 404 || error.status === 403)
    ) {
      return null;
    }
    throw error;
  }
}

export async function createOrder(
  input: OrderCreateInput,
  _actor: ScopeActor,
): Promise<OrderWriteResult> {
  try {
    const created = await backendRequest<{ id: string }>("/seller/orders", {
      method: "POST",
      accessToken: await accessToken(),
      body: {
        customerId: input.customerId,
        items: input.items.map((i) => ({
          productId: i.productId,
          quantity: i.qty,
          price: i.unitPrice ?? undefined,
        })),
        notes: input.notes ?? undefined,
        inquiryId: input.inquiryId ?? undefined,
      },
    });

    return { ok: true, id: created.id };
  } catch (error) {
    if (!(error instanceof BackendApiError)) {
      throw error;
    }

    const lineFailure = lineBuildFailure(error);
    if (lineFailure) {
      return lineFailure;
    }

    switch (error.code) {
      case "customer_not_found":
        return { ok: false, reason: "customer_not_found" };
      case "inquiry_not_found":
        return { ok: false, reason: "inquiry_not_found" };
      case "number_conflict":
        return { ok: false, reason: "number_conflict" };
      default:
        throw error;
    }
  }
}

export async function updateOrder(
  id: string,
  input: OrderUpdateInput,
  _actor: ScopeActor,
): Promise<OrderWriteResult> {
  try {
    const updated = await backendRequest<{ id: string }>(`/seller/orders/${id}`, {
      method: "PATCH",
      accessToken: await accessToken(),
      body: {
        status: input.status ? toBackendStatus(input.status) : undefined,
        items: input.items?.map((i) => ({
          productId: i.productId,
          quantity: i.qty,
          price: i.unitPrice ?? undefined,
        })),
        // Clearing notes back to null is not currently expressible — the
        // backend DTO is `@IsString() @IsOptional()`, so a `null` would 400.
        // No caller does it.
        notes: input.notes ?? undefined,
      },
    });

    return { ok: true, id: updated.id };
  } catch (error) {
    if (!(error instanceof BackendApiError)) {
      throw error;
    }

    if (error.status === 404) {
      return { ok: false, reason: "not_found" };
    }

    const lineFailure = lineBuildFailure(error);
    if (lineFailure) {
      return lineFailure;
    }

    switch (error.code) {
      case "locked":
        return { ok: false, reason: "locked" };
      case "illegal_transition": {
        const body = (error.body ?? {}) as { from?: string; to?: string };
        return {
          ok: false,
          reason: "illegal_transition",
          from: toRootStatus(body.from ?? ""),
          to: toRootStatus(body.to ?? ""),
        };
      }
      default:
        throw error;
    }
  }
}

export async function requestOrderDiscount(
  id: string,
  input: DiscountRequestInput,
  _actor: DiscountActor,
): Promise<OrderDiscountResult> {
  try {
    const res = await backendRequest<
      | { kind: "immediate"; totalAmount: number }
      | { kind: "needs_approval"; requestId: string }
    >(`/seller/orders/${id}/discount-request`, {
      method: "POST",
      accessToken: await accessToken(),
      body: { percent: input.percent, reason: input.reason ?? undefined },
    });

    return res.kind === "immediate"
      ? { ok: true, kind: "immediate", totalAmount: res.totalAmount }
      : { ok: true, kind: "needs_approval", requestId: res.requestId };
  } catch (error) {
    if (!(error instanceof BackendApiError)) {
      throw error;
    }

    if (error.status === 404) {
      return { ok: false, reason: "not_found" };
    }

    if (error.status === 409) {
      if (error.code === "pending_exists") {
        return { ok: false, reason: "pending_exists" };
      }
      if (error.code === "locked") {
        return { ok: false, reason: "locked" };
      }
    }

    throw error;
  }
}
