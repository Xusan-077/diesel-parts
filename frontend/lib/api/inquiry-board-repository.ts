import "server-only";
import { BackendApiError, backendRequest } from "./backend-client";
import { getStaffSession } from "@/lib/auth/staff-session";
import { INQUIRY_COLUMNS, type InquiryColumn } from "./inquiry-board";
import type { ScopeActor } from "./seller-scope";
import type { InquiryListQuery, InquiryUpdateInput } from "@/lib/schemas";
import type { InquiryStatus, InquirySource } from "@/lib/api/backend-enums";

/**
 * The seller board's reads and writes, over `backend/`'s `seller/inquiries`.
 * Public-site inquiry creation stays in `inquiry-repository.ts`: that path
 * takes no actor, needs no scoping, and hits the unauthenticated
 * `POST /inquiries` endpoint. The audit trail lives server-side now — the
 * backend's `claim` and `update` write their own entries.
 */

export const SELLER_PAGE_SIZE = 20;

export interface InquiryRow {
  id: string;
  customerName: string;
  phone: string;
  email: string | null;
  message: string;
  productId: string | null;
  productSku: string | null;
  quantity: number | null;
  status: InquiryStatus;
  source: InquirySource;
  column: InquiryColumn;
  assignedSellerId: string | null;
  assignedSellerName: string | null;
  notes: string | null;
  followUpAt: Date | null;
  createdAt: Date;
}

export interface InquiryPage {
  items: InquiryRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** The wire shape from `InquiriesService.toRow` — dates as ISO strings. */
interface BackendInquiryRow extends Omit<InquiryRow, "followUpAt" | "createdAt"> {
  followUpAt: string | null;
  createdAt: string;
}

interface BackendInquiryPage {
  data: BackendInquiryRow[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

async function accessToken(): Promise<string | undefined> {
  const session = await getStaffSession();
  return session?.accessToken;
}

function toRow(row: BackendInquiryRow): InquiryRow {
  return {
    ...row,
    followUpAt: row.followUpAt === null ? null : new Date(row.followUpAt),
    createdAt: new Date(row.createdAt),
  };
}

/**
 * `_actor` is not sent to backend/: `seller/inquiries` scopes every read and
 * write from the caller's own access token via `@CurrentUser()`, never a
 * client-supplied actor object (the parameter stays here only because every
 * caller already has one to hand, and it is always the same session's own —
 * see `lib/api/customer-repository.ts`'s identical doc comment).
 */
export async function listInquiries(
  _actor: ScopeActor,
  query: InquiryListQuery,
): Promise<InquiryPage> {
  const result = await backendRequest<BackendInquiryPage>("/seller/inquiries", {
    accessToken: await accessToken(),
    query: {
      column: query.column,
      sellerId: query.sellerId,
      page: query.page,
    },
  });

  return {
    items: result.data.map(toRow),
    total: result.meta.total,
    page: result.meta.page,
    pageSize: result.meta.limit ?? SELLER_PAGE_SIZE,
    totalPages: result.meta.totalPages,
  };
}

export type ClaimResult =
  | { ok: true; id: string }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "taken" };

/**
 * Claims one lead. The backend's `POST :id/claim` is the compare-and-set and
 * writes its own audit entry; a lost race comes back as a 409, a missing row
 * as a 404. The route handler owns the user-facing copy for both.
 */
export async function claimInquiry(id: string, _actor: ScopeActor): Promise<ClaimResult> {
  try {
    const claimed = await backendRequest<{ id: string }>(`/seller/inquiries/${id}/claim`, {
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

export type InquiryWriteResult = { ok: true; id: string } | { ok: false; reason: "not_found" };

/**
 * Moves a card, leaves a note, or sets a callback date.
 *
 * `notes` and `followUpAt` may be an explicit `null` (the schema is
 * `.nullable().optional()`) and the backend DTO clears the field on `null`, so
 * the values pass through as-is — `undefined` keys are dropped by
 * `JSON.stringify`, `null` keys are kept. An unowned or missing row answers a
 * 404, which the route turns into `not_found`. The backend also rejects a
 * zero-field body with a 400, but `inquiryUpdateSchema.refine` makes that
 * unreachable from the route; if it ever surfaces it rethrows.
 */
export async function updateInquiry(
  id: string,
  input: InquiryUpdateInput,
  _actor: ScopeActor,
): Promise<InquiryWriteResult> {
  try {
    const updated = await backendRequest<{ id: string }>(`/seller/inquiries/${id}`, {
      method: "PATCH",
      accessToken: await accessToken(),
      body: {
        status: input.status,
        notes: input.notes,
        followUpAt: input.followUpAt,
      },
    });
    return { ok: true, id: updated.id };
  } catch (error) {
    if (error instanceof BackendApiError && error.status === 404) {
      return { ok: false, reason: "not_found" };
    }
    throw error;
  }
}

export interface InquiryBoardColumn {
  items: InquiryRow[];
  /** Rows in the column, which may exceed the page the board loaded. */
  total: number;
}

export type InquiryBoard = Record<InquiryColumn, InquiryBoardColumn>;

/**
 * Every column at once, for the board screen. The backend computes each
 * column, its per-column ordering (closed columns newest-first), and the
 * one-page cap; this only maps the wire rows' dates back to `Date`.
 */
export async function listInquiryBoard(_actor: ScopeActor): Promise<InquiryBoard> {
  const board = await backendRequest<
    Record<InquiryColumn, { items: BackendInquiryRow[]; total: number }>
  >("/seller/inquiries/board", { accessToken: await accessToken() });

  return Object.fromEntries(
    INQUIRY_COLUMNS.map((column) => [
      column,
      { items: board[column].items.map(toRow), total: board[column].total },
    ]),
  ) as InquiryBoard;
}
