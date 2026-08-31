import "server-only";
import { BackendApiError, backendRequest } from "./backend-client";
import { getStaffSession } from "@/lib/auth/staff-session";

export interface DiscountRequestView {
  id: string;
  orderId: string;
  orderNumber: string;
  sellerName: string;
  sellerLimit: number;
  customerName: string;
  requestedPercent: number;
  reason: string | null;
  subtotal: number;
  /** What the order would total if this request were approved. */
  totalIfApproved: number;
  createdAt: Date;
}

interface BackendDiscountRequest extends Omit<DiscountRequestView, "createdAt"> {
  createdAt: string;
}

async function accessToken(): Promise<string | undefined> {
  const session = await getStaffSession();
  return session?.accessToken;
}

export async function listPendingDiscounts(): Promise<DiscountRequestView[]> {
  const rows = await backendRequest<BackendDiscountRequest[]>("/discount-requests", {
    accessToken: await accessToken(),
  });

  return rows.map((row) => ({ ...row, createdAt: new Date(row.createdAt) }));
}

export type DecisionResult =
  | { ok: true }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "already_decided" };

/**
 * Approves or rejects one request.
 *
 * `reviewerId` is not sent to backend/: its `PATCH .../decision` endpoint
 * takes the reviewer from the caller's own access token, never a body field
 * (the parameter stays here only because every route handler already passes
 * `guard.user.id`, and that id is always the same session's own).
 */
export async function decideDiscount(
  id: string,
  approve: boolean,
  _reviewerId: string,
  note: string | null,
): Promise<DecisionResult> {
  try {
    await backendRequest(`/discount-requests/${id}/decision`, {
      method: "PATCH",
      accessToken: await accessToken(),
      body: { approve, note },
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof BackendApiError && error.status === 404) {
      return { ok: false, reason: "not_found" };
    }
    if (error instanceof BackendApiError && error.status === 409) {
      return { ok: false, reason: "already_decided" };
    }
    throw error;
  }
}

export interface AuditEntryView {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorName: string | null;
  before: unknown;
  after: unknown;
  createdAt: Date;
}

export interface AuditPage {
  items: AuditEntryView[];
  page: number;
  totalPages: number;
  total: number;
}

interface BackendAuditEntry extends Omit<AuditEntryView, "createdAt"> {
  createdAt: string;
}

interface BackendAuditPage {
  data: BackendAuditEntry[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export async function listAudit(page: number, entityType?: string): Promise<AuditPage> {
  const result = await backendRequest<BackendAuditPage>("/audit", {
    accessToken: await accessToken(),
    query: { page, entityType },
  });

  return {
    items: result.data.map((row) => ({ ...row, createdAt: new Date(row.createdAt) })),
    page: result.meta.page,
    totalPages: result.meta.totalPages,
    total: result.meta.total,
  };
}

/** Distinct entity types present, so the filter offers only what exists. */
export async function listAuditEntityTypes(): Promise<string[]> {
  return backendRequest<string[]>("/audit/entity-types", { accessToken: await accessToken() });
}
