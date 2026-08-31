import "server-only";
import { BackendApiError, backendRequest } from "./backend-client";
import { getStaffSession } from "@/lib/auth/staff-session";
import type { ScopeActor } from "./seller-scope";
import type { CustomerCreateInput, CustomerListQuery, CustomerUpdateInput } from "@/lib/schemas";
import type { InquiryStatus } from "@/lib/api/backend-enums";

/** The seller's own customer book. */

export interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  company: string | null;
  notes: string | null;
  assignedSellerId: string | null;
  assignedSellerName: string | null;
  orderCount: number;
  /** Sum of COMPLETED orders only — the same "only landed sales count" rule
   *  `product-stats-repository.ts` uses, so this never counts a draft. */
  totalSpent: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerPage {
  items: CustomerRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface BackendCustomerRow extends Omit<CustomerRow, "createdAt" | "updatedAt"> {
  createdAt: string;
  updatedAt: string;
}

interface BackendCustomerPage {
  data: BackendCustomerRow[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

async function accessToken(): Promise<string | undefined> {
  const session = await getStaffSession();
  return session?.accessToken;
}

function toRow(row: BackendCustomerRow): CustomerRow {
  return { ...row, createdAt: new Date(row.createdAt), updatedAt: new Date(row.updatedAt) };
}

/**
 * `_actor` is not sent to backend/: `seller/customers` scopes every read and
 * write from the caller's own access token via `@CurrentUser()`, never a
 * client-supplied actor object (the parameter stays here only because every
 * caller already has one to hand, and it is always the same session's own —
 * see `lib/api/discount-repository.ts`'s identical `_reviewerId` doc comment).
 */
export async function listCustomers(
  _actor: ScopeActor,
  query: CustomerListQuery,
): Promise<CustomerPage> {
  const result = await backendRequest<BackendCustomerPage>("/seller/customers", {
    accessToken: await accessToken(),
    query: {
      search: query.search,
      page: query.page,
      pool: query.pool ? "true" : "false",
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

/** Reads include the unclaimed pool: a seller cannot claim what they cannot see. */
export async function getCustomer(id: string, _actor: ScopeActor): Promise<CustomerRow | null> {
  try {
    const row = await backendRequest<BackendCustomerRow>(`/seller/customers/${id}`, {
      accessToken: await accessToken(),
    });
    return toRow(row);
  } catch (error) {
    if (error instanceof BackendApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export type CustomerWriteResult = { ok: true; id: string } | { ok: false; reason: "not_found" };

export async function createCustomer(
  input: CustomerCreateInput,
  _actor: ScopeActor,
): Promise<{ ok: true; id: string }> {
  const created = await backendRequest<{ id: string }>("/seller/customers", {
    method: "POST",
    accessToken: await accessToken(),
    body: input,
  });

  return { ok: true, id: created.id };
}

export async function updateCustomer(
  id: string,
  input: CustomerUpdateInput,
  _actor: ScopeActor,
): Promise<CustomerWriteResult> {
  try {
    const updated = await backendRequest<{ id: string }>(`/seller/customers/${id}`, {
      method: "PATCH",
      accessToken: await accessToken(),
      body: input,
    });
    return { ok: true, id: updated.id };
  } catch (error) {
    if (error instanceof BackendApiError && error.status === 404) {
      return { ok: false, reason: "not_found" };
    }
    throw error;
  }
}

export type CustomerClaimResult =
  | { ok: true; id: string }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "taken" };

/** Same compare-and-set as an inquiry claim, for the unassigned pool tab. */
export async function claimCustomer(id: string, _actor: ScopeActor): Promise<CustomerClaimResult> {
  try {
    const claimed = await backendRequest<{ id: string }>(`/seller/customers/${id}/claim`, {
      method: "POST",
      accessToken: await accessToken(),
    });
    return { ok: true, id: claimed.id };
  } catch (error) {
    if (error instanceof BackendApiError && error.status === 404) {
      return { ok: false, reason: "not_found" };
    }
    if (error instanceof BackendApiError && error.status === 409) {
      return { ok: false, reason: "taken" };
    }
    throw error;
  }
}

/** One inquiry from the same number, for the customer's history. */
export interface CustomerInquiryRow {
  id: string;
  message: string;
  status: InquiryStatus;
  assignedSellerId: string | null;
  assignedSellerName: string | null;
  productSku: string | null;
  quantity: number | null;
  notes: string | null;
  createdAt: Date;
}

/**
 * backend/'s `seller/inquiries/by-phone` row — a superset (it reuses
 * `InquiriesService`'s own `ROW_SELECT`/`toRow`, which also carries
 * `customerName`, `phone`, `email`, `source`, `column`, `followUpAt`). Only
 * the fields `CustomerInquiryRow` declares are picked out below.
 */
interface BackendInquiryRow {
  id: string;
  message: string;
  status: InquiryStatus;
  productSku: string | null;
  quantity: number | null;
  assignedSellerId: string | null;
  assignedSellerName: string | null;
  notes: string | null;
  createdAt: string;
}

/**
 * The inquiries that came from this customer's number.
 *
 * Matched on the phone because there is no foreign key to match on: an
 * `Inquiry` is raised by an anonymous visitor before anybody knows which
 * account they belong to, and the board's "save as customer" copies the number
 * across rather than writing a link. The screen says so in as many words, so
 * the seller reads this as "calls from this number" and not as a guarantee.
 */
export async function listCustomerInquiries(
  phone: string,
  _actor: ScopeActor,
): Promise<CustomerInquiryRow[]> {
  const rows = await backendRequest<BackendInquiryRow[]>("/seller/inquiries/by-phone", {
    accessToken: await accessToken(),
    query: { phone },
  });

  return rows.map((row) => ({
    id: row.id,
    message: row.message,
    status: row.status,
    assignedSellerId: row.assignedSellerId,
    assignedSellerName: row.assignedSellerName,
    productSku: row.productSku,
    quantity: row.quantity,
    notes: row.notes,
    createdAt: new Date(row.createdAt),
  }));
}

/**
 * Which of these numbers the caller already keeps a customer card for.
 *
 * Feeds the board, where a card offers "save as customer" only when the number
 * is new to the book. Keyed by canonical digits, which is the form the caller
 * must look rows up by — backend/'s `by-phone` response is already keyed this
 * way, so this only rebuilds the `Map` a `fetch` response can't carry.
 */
export async function findCustomersByPhone(
  phones: readonly string[],
  _actor: ScopeActor,
): Promise<Map<string, { id: string; name: string }>> {
  if (phones.length === 0) {
    return new Map();
  }

  const rows = await backendRequest<Array<{ phone: string; id: string; name: string }>>(
    "/seller/customers/by-phone",
    {
      accessToken: await accessToken(),
      query: { phones: phones.join(",") },
    },
  );

  return new Map(rows.map((row) => [row.phone, { id: row.id, name: row.name }]));
}
