import type { AdminProductPage, ProductEditRecord } from "@/lib/api/product-write-repository";
import type { AuditEntryView, DiscountRequestView } from "@/lib/api/discount-repository";
import type { CatalogAdminRow } from "@/lib/api/catalog-repository";
import type { CustomerPage, CustomerRow } from "@/lib/api/customer-repository";
import type { InquiryPage } from "@/lib/api/inquiry-board-repository";
import type { InquiryBoardView } from "@/lib/api/inquiry-board-view";
import type { ModeratedReview } from "@/lib/api/review-repository";
import type { StaffRow } from "@/lib/api/user-repository";
import type {
  AdminProductListQuery,
  AiFillResult,
  AuditListQuery,
  CategoryWriteInput,
  CustomerCreateInput,
  CustomerListQuery,
  CustomerUpdateInput,
  DiscountDecisionInput,
  InquiryListQuery,
  InquiryUpdateInput,
  ProductWriteInput,
  UserCreateInput,
  UserUpdateInput,
} from "@/lib/schemas";
import { panelClient } from "./client";

/**
 * Every request the panel makes, typed once.
 *
 * The hooks in `hooks/admin` are about caching and invalidation; this file is
 * about what each endpoint is called and what it answers. Keeping them apart
 * means a route that gains a query parameter is changed here and nowhere else,
 * and a component never spells a URL.
 *
 * The panel's routes answer `{ success: true, ...payload }`. The flag is
 * ignored on the way through — a rejected promise is how a failure reaches a
 * caller, so a boolean that is always true where it is read carries nothing.
 */

interface Envelope {
  success?: boolean;
}

/* ── Products ─────────────────────────────────────────────────────────────── */

export async function fetchAdminProducts(
  query: AdminProductListQuery,
): Promise<AdminProductPage> {
  const { data } = await panelClient.get<AdminProductPage & Envelope>("/products", {
    params: { q: query.q, page: query.page, all: query.all ? "1" : "0", sort: query.sort },
  });
  return data;
}

/** The write payload behind one row, as the edit form wants it — plus its current photo. */
export async function fetchProductForEdit(id: string): Promise<ProductEditRecord> {
  const { data } = await panelClient.get<{ product: ProductEditRecord }>("/products/" + id);
  return data.product;
}

/**
 * Plain JSON when there is no photo to attach yet; `multipart/form-data` when
 * there is, with the same fields carried as a `data` part alongside the file.
 * The `undefined` Content-Type below is what lets the browser compute the
 * multipart boundary itself — the instance's default `application/json`
 * would otherwise win and the server would receive an unparsable body.
 */
export async function createProduct(
  input: ProductWriteInput,
  image?: File | null,
): Promise<{ id: string }> {
  if (!image) {
    const { data } = await panelClient.post<{ id: string }>("/products", input);
    return data;
  }

  const form = new FormData();
  form.set("data", JSON.stringify(input));
  form.set("image", image);
  const { data } = await panelClient.post<{ id: string }>("/products", form, {
    headers: { "Content-Type": undefined },
  });
  return data;
}

export async function updateProduct(id: string, input: ProductWriteInput): Promise<void> {
  await panelClient.patch("/products/" + id, input);
}

/** Replaces a product's photo alone, through its own single-file endpoint. */
export async function replaceProductImage(id: string, image: File): Promise<{ imageUrl: string }> {
  const form = new FormData();
  form.set("image", image);
  const { data } = await panelClient.patch<{ imageUrl: string }>("/products/" + id + "/image", form, {
    headers: { "Content-Type": undefined },
  });
  return data;
}

/**
 * Archiving, not deleting. `OrderItem` references a product with `Restrict`,
 * and an order has to keep meaning something after a part leaves the catalogue.
 */
export async function archiveProduct(id: string): Promise<void> {
  await panelClient.delete("/products/" + id);
}

/**
 * Putting an archived product back. A restore is an ordinary field edit, so it
 * goes through the write route rather than earning an endpoint of its own —
 * which is why the current values have to be read first.
 */
export async function restoreProduct(id: string): Promise<void> {
  const current = await fetchProductForEdit(id);
  await panelClient.patch("/products/" + id, { ...current, isActive: true });
}

/**
 * Looks a part up by its OEM number ("OEM raqam bilan (AI)"). Returns a
 * pre-filled write payload for the create dialog to show — nothing is saved
 * until the director presses "Tasdiqlash va qo'shish", which goes through
 * `createProduct` exactly like a manually-filled form.
 */
export async function aiFillProduct(oemNumber: string, category?: string): Promise<AiFillResult> {
  const { data } = await panelClient.post<{ result: AiFillResult } & Envelope>("/products/ai-fill", {
    oemNumber,
    category,
  });
  return data.result;
}

/** Generates a studio photo and hands back its bytes — see the route's own doc comment. */
export async function aiGenerateProductImage(
  productName: string,
  oemNumber?: string,
): Promise<{ base64: string; mimeType: string }> {
  const { data } = await panelClient.post<{ base64: string; mimeType: string } & Envelope>(
    "/products/ai-generate-image",
    { productName, oemNumber },
  );
  return { base64: data.base64, mimeType: data.mimeType };
}

/* ── Categories ───────────────────────────────────────────────────────────── */

export async function fetchCategories(): Promise<CatalogAdminRow[]> {
  const { data } = await panelClient.get<{ items: CatalogAdminRow[] }>("/categories");
  return data.items;
}

export async function createCategory(input: CategoryWriteInput): Promise<{ id: string }> {
  const { data } = await panelClient.post<{ id: string }>("/categories", input);
  return data;
}

export async function updateCategory(id: string, input: CategoryWriteInput): Promise<void> {
  await panelClient.patch("/categories/" + id, input);
}

export async function deleteCategory(id: string): Promise<void> {
  await panelClient.delete("/categories/" + id);
}

/* ── Staff ────────────────────────────────────────────────────────────────── */

/**
 * `StaffRow` as it survives the wire. The repository hands back a `Date`;
 * JSON has no such thing, so what the browser actually receives is the ISO
 * string — and typing it as a `Date` would be a lie that only shows up as
 * `.toISOString is not a function` in a component.
 */
export type StaffListRow = Omit<StaffRow, "createdAt"> & { createdAt: string };

export async function fetchStaff(): Promise<StaffListRow[]> {
  const { data } = await panelClient.get<{ users: StaffListRow[] }>("/users");
  return data.users;
}

export async function createStaff(input: UserCreateInput): Promise<{ id: string }> {
  const { data } = await panelClient.post<{ id: string }>("/users", input);
  return data;
}

export async function updateStaff(id: string, input: UserUpdateInput): Promise<void> {
  await panelClient.patch("/users/" + id, input);
}

/* ── Reviews ──────────────────────────────────────────────────────────────── */

export interface AdminReviewPage {
  items: ModeratedReview[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function fetchAdminReviews(page: number): Promise<AdminReviewPage> {
  const { data } = await panelClient.get<AdminReviewPage & Envelope>("/reviews", {
    params: { page },
  });
  return data;
}

export async function setReviewApproval(id: string, isApproved: boolean): Promise<void> {
  await panelClient.patch("/reviews/" + id, { isApproved });
}

export async function deleteReview(id: string): Promise<void> {
  await panelClient.delete("/reviews/" + id);
}

/* ── Discount requests ────────────────────────────────────────────────────── */

/** `DiscountRequestView` after JSON: the timestamp arrives as a string. */
export type DiscountListRow = Omit<DiscountRequestView, "createdAt"> & { createdAt: string };

export async function fetchPendingDiscounts(): Promise<DiscountListRow[]> {
  const { data } = await panelClient.get<{ items: DiscountListRow[] }>("/discount-requests");
  return data.items;
}

export async function decideDiscount(id: string, decision: DiscountDecisionInput): Promise<void> {
  await panelClient.post("/discount-requests/" + id, decision);
}

/* ── Audit trail ──────────────────────────────────────────────────────────── */

/** `AuditEntryView` after JSON: the timestamp arrives as a string. */
export type AuditListRow = Omit<AuditEntryView, "createdAt"> & { createdAt: string };

export interface AuditListResult {
  items: AuditListRow[];
  page: number;
  total: number;
  totalPages: number;
  /** Every entity type present in the log, for the filter above the table. */
  entityTypes: string[];
}

export async function fetchAudit(query: AuditListQuery): Promise<AuditListResult> {
  const { data } = await panelClient.get<AuditListResult & Envelope>("/audit", {
    params: { page: query.page, ...(query.entityType ? { entityType: query.entityType } : {}) },
  });
  return data;
}

/* ── Inquiries ────────────────────────────────────────────────────────────── */

export async function fetchInquiries(query: InquiryListQuery): Promise<InquiryPage> {
  const { data } = await panelClient.get<InquiryPage & Envelope>("/inquiries", {
    params: {
      page: query.page,
      ...(query.column ? { column: query.column } : {}),
      ...(query.sellerId ? { sellerId: query.sellerId } : {}),
    },
  });
  return data;
}

/** The board, in the shape the screen draws — five capped columns and totals. */
export async function fetchInquiryBoard(): Promise<InquiryBoardView> {
  const { data } = await panelClient.get<InquiryBoardView>("/inquiries/board");
  return data;
}

export async function updateInquiry(id: string, input: InquiryUpdateInput): Promise<void> {
  await panelClient.patch("/inquiries/" + id, input);
}

export async function claimInquiry(id: string): Promise<void> {
  await panelClient.post("/inquiries/" + id + "/claim");
}

/* ── Customers ────────────────────────────────────────────────────────────── */

/** `CustomerRow` after JSON: both timestamps arrive as strings. */
export type CustomerListRow = Omit<CustomerRow, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

export interface CustomerListResult extends Omit<CustomerPage, "items"> {
  items: CustomerListRow[];
}

/**
 * A seller's customer book, or with `pool: true` the unassigned accounts they
 * may claim. A director sees every customer either way — the scope is applied
 * in the repository, never in the caller.
 */
export async function fetchCustomers(query: CustomerListQuery): Promise<CustomerListResult> {
  const { data } = await panelClient.get<CustomerListResult & Envelope>("/customers", {
    params: {
      page: query.page,
      pool: query.pool ? "true" : "false",
      ...(query.search ? { search: query.search } : {}),
    },
  });
  return data;
}

export async function createCustomer(input: CustomerCreateInput): Promise<{ id?: string }> {
  const { data } = await panelClient.post<{ id?: string }>("/customers", input);
  return data;
}

export async function updateCustomer(id: string, input: CustomerUpdateInput): Promise<void> {
  await panelClient.patch("/customers/" + id, input);
}

export async function claimCustomer(id: string): Promise<void> {
  await panelClient.post("/customers/" + id + "/claim");
}
