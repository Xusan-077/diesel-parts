import "server-only";
import { backendRequest } from "./backend-client";
import { callBackendPhoneVerified } from "./internal-backend";
import { getStaffSession } from "@/lib/auth/staff-session";
import type { Page } from "./product-query";
import type { PublicReview } from "@/lib/reviews";

interface BackendPage<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

function toPage<T>(result: BackendPage<T>): Page<T> {
  return {
    items: result.data,
    total: result.meta.total,
    page: result.meta.page,
    pageSize: result.meta.limit,
    totalPages: result.meta.totalPages,
  };
}

async function accessToken(): Promise<string | undefined> {
  const session = await getStaffSession();
  return session?.accessToken;
}

/**
 * One page of a product's visible reviews, newest first — backend/'s `GET
 * /reviews` is fully public, matching this read's own guardless past.
 *
 * `ownPhone` is the session's phone when there is one. It is sent so
 * backend/ can mark the reader's own entry `isMine: true` — never to widen
 * which rows are visible.
 */
export async function listProductReviews(
  productId: string,
  page: number,
  pageSize: number,
  ownPhone?: string | null,
): Promise<Page<PublicReview>> {
  const result = await backendRequest<BackendPage<PublicReview>>("/reviews", {
    query: { productId, page, limit: pageSize, authorPhone: ownPhone ?? undefined },
  });

  return toPage(result);
}

/**
 * Writes this person's review of this part.
 *
 * Signed via `callBackendPhoneVerified` (the same HMAC-over-phone scheme
 * `carts/*`/`checkout` already use): `PUT /reviews` is gated by backend/'s
 * `InternalServiceGuard`, which proves this call came from this app's own
 * server-side code — the OTP session that authorized `authorPhone` was
 * already checked by the caller before this runs.
 */
export async function upsertReview(input: {
  productId: string;
  authorPhone: string;
  rating: number;
  body: string;
  authorName: string;
}): Promise<PublicReview> {
  const { authorPhone, ...body } = input;
  return callBackendPhoneVerified<PublicReview>(authorPhone, "reviews", { method: "PUT", body });
}

/** This person's review of this part, for seeding the form. */
export async function getOwnReview(
  productId: string,
  authorPhone: string,
): Promise<PublicReview | null> {
  return callBackendPhoneVerified<PublicReview | null>(
    authorPhone,
    `reviews/mine?productId=${encodeURIComponent(productId)}`,
  );
}

/* ── Moderation ───────────────────────────────────────────────────────────── */

/** A review as the director's queue shows it, product and all. */
export interface ModeratedReview extends PublicReview {
  isApproved: boolean;
  product: { id: string; slug: string; name: string };
}

/**
 * Every review, visible or hidden, newest first.
 *
 * Hidden rows are included on purpose: a director who takes something down has
 * to be able to see what they took down, and to put it back.
 */
export async function listAllReviews(
  page: number,
  pageSize: number,
): Promise<Page<ModeratedReview>> {
  const result = await backendRequest<BackendPage<ModeratedReview>>("/reviews/admin", {
    accessToken: await accessToken(),
    query: { page, limit: pageSize },
  });

  return toPage(result);
}

/** Takes a review off the site, or puts it back. */
export async function setReviewApproval(id: string, isApproved: boolean): Promise<void> {
  await backendRequest(`/reviews/${id}/approval`, {
    method: "PATCH",
    accessToken: await accessToken(),
    body: { isApproved },
  });
}

export async function deleteReview(id: string): Promise<void> {
  await backendRequest(`/reviews/${id}`, { method: "DELETE", accessToken: await accessToken() });
}

/* ── Who may write ────────────────────────────────────────────────────────── */

/**
 * Whether this person has actually bought this part — `GET
 * /reviews/purchase-check`, signed the same way `upsertReview` is.
 */
export async function hasPurchasedProduct(productId: string, phone: string): Promise<boolean> {
  const result = await callBackendPhoneVerified<{ purchased: boolean }>(
    phone,
    `reviews/purchase-check?productId=${encodeURIComponent(productId)}`,
  );
  return result.purchased;
}
