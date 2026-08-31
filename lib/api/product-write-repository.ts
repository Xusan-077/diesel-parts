import "server-only";
import { BackendApiError, backendRequest } from "./backend-client";
import { getStaffSession } from "@/lib/auth/staff-session";
import type { ProductWriteInput } from "@/lib/schemas";

/**
 * Writes to the catalog. Reads live in `product-repository.ts`; they are split
 * because every page reads and only the director's panel writes.
 *
 * No `recordAudit` calls here: backend/'s `ProductsService` already logs
 * every create/update/retire itself (Part 1 Task 4) — doing it again here
 * would double-log every write.
 */

export type WriteResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: "duplicate"; field: string }
  | { ok: false; reason: "missing_reference"; field: string }
  | { ok: false; reason: "not_found" };

async function accessToken(): Promise<string | undefined> {
  const session = await getStaffSession();
  return session?.accessToken;
}

/** Maps a caught backend/ failure onto `WriteResult`'s error union, or rethrows. */
function writeFailure(error: unknown): WriteResult<never> {
  if (error instanceof BackendApiError && error.status === 409) {
    // ConflictException's message is "<field> already exists" (Part 1 Task 8's follow-up).
    return { ok: false, reason: "duplicate", field: error.message.split(" ")[0] };
  }
  if (error instanceof BackendApiError && error.status === 400) {
    return { ok: false, reason: "missing_reference", field: "categoryId" };
  }
  throw error;
}

function toBody(input: ProductWriteInput) {
  return {
    sku: input.sku.trim().toUpperCase(),
    slug: input.slug.trim(),
    // Upper-cased on the way in, because search matches them with Prisma's
    // array `has`, which takes no case-insensitivity mode.
    oemNumbers: input.oemNumbers.map((oem) => oem.trim().toUpperCase()),
    nameUz: input.name.uz,
    nameRu: input.name.ru,
    nameEn: input.name.en,
    descriptionUz: input.description.uz,
    descriptionRu: input.description.ru,
    descriptionEn: input.description.en,
    price: input.price,
    stock: input.stock,
    minStock: input.minStock,
    categoryId: input.categoryId,
    brandId: input.brandId,
    compatibleModels: input.compatibleModels,
    specs: input.specs,
    isActive: input.isActive,
  };
}

export async function createProduct(
  input: ProductWriteInput,
  _actorId: string,
): Promise<WriteResult<{ id: string }>> {
  try {
    const created = await backendRequest<{ id: string }>("/products", {
      method: "POST",
      accessToken: await accessToken(),
      body: toBody(input),
    });
    return { ok: true, value: { id: created.id } };
  } catch (error) {
    return writeFailure(error);
  }
}

export async function updateProduct(
  id: string,
  input: ProductWriteInput,
  _actorId: string,
): Promise<WriteResult<{ id: string }>> {
  try {
    await backendRequest(`/products/${id}`, {
      method: "PATCH",
      accessToken: await accessToken(),
      body: toBody(input),
    });
    return { ok: true, value: { id } };
  } catch (error) {
    if (error instanceof BackendApiError && error.status === 404) {
      return { ok: false, reason: "not_found" };
    }
    return writeFailure(error);
  }
}

/**
 * Retirement, not deletion.
 *
 * OrderItem references Product with `Restrict`, so a sold part can never be
 * deleted — and should not be: the order it appears on has to keep meaning
 * something. Clearing `isActive` takes it out of the catalog and every query.
 */
export async function setProductActive(
  id: string,
  isActive: boolean,
  _actorId: string,
): Promise<WriteResult<{ id: string }>> {
  try {
    await backendRequest(`/products/${id}`, {
      method: "PATCH",
      accessToken: await accessToken(),
      body: { isActive },
    });
    return { ok: true, value: { id } };
  } catch (error) {
    if (error instanceof BackendApiError && error.status === 404) {
      return { ok: false, reason: "not_found" };
    }
    throw error;
  }
}

export interface AdminProductRow {
  id: string;
  sku: string;
  slug: string;
  name: string;
  price: number | null;
  stock: number;
  minStock: number;
  categoryName: string;
  brandName: string;
  isActive: boolean;
  imageUrl: string | null;
}

export interface AdminProductPage {
  items: AdminProductRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const ADMIN_PAGE_SIZE = 20;

interface BackendAdminRow {
  id: string;
  sku: string;
  slug: string;
  nameUz: string;
  price: string | null;
  availableQuantity: number;
  minStock: number;
  category: { nameUz: string };
  brand: { name: string };
  isActive: boolean;
  imageUrl: string | null;
}

/**
 * The panel's own listing. It differs from the public one in three ways that
 * matter: inactive products are included (or excluded, via `includeInactive`),
 * stock numbers are exposed, and the sort defaults to what a director looks
 * for — the shortest stock first.
 */
export async function listProductsForAdmin(options: {
  search: string;
  page: number;
  includeInactive: boolean;
  sort: "stock" | "name" | "price";
}): Promise<AdminProductPage> {
  const result = await backendRequest<{
    data: BackendAdminRow[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }>("/products", {
    accessToken: await accessToken(),
    query: {
      search: options.search.trim() || undefined,
      isActive: options.includeInactive ? undefined : "true",
      sort: options.sort === "name" ? "name-asc" : options.sort === "price" ? "price-desc" : "stock",
      lang: options.sort === "name" ? "uz" : undefined,
      page: options.page,
      limit: ADMIN_PAGE_SIZE,
    },
  });

  return {
    items: result.data.map((row) => ({
      id: row.id,
      sku: row.sku,
      slug: row.slug,
      name: row.nameUz,
      price: row.price === null ? null : Number(row.price),
      stock: row.availableQuantity,
      minStock: row.minStock,
      categoryName: row.category.nameUz,
      brandName: row.brand.name,
      isActive: row.isActive,
      imageUrl: row.imageUrl,
    })),
    total: result.meta.total,
    page: result.meta.page,
    pageSize: result.meta.limit,
    totalPages: result.meta.totalPages,
  };
}

/**
 * The write shape plus the one field that never goes through it: `imageUrl` is
 * set only by the image-upload endpoints (see `setProductImage`), so the form
 * needs it for the preview but must never round-trip it through
 * `productWriteSchema` on save.
 */
export interface ProductEditRecord extends ProductWriteInput {
  imageUrl: string | null;
}

interface BackendEditRow extends BackendAdminRow {
  oemNumbers: string[];
  nameRu: string;
  nameEn: string;
  descriptionUz: string;
  descriptionRu: string;
  descriptionEn: string;
  categoryId: string;
  brandId: string;
  compatibleModels: string[];
  specs: unknown;
}

/** One product in the shape the edit form expects. */
export async function getProductForEdit(id: string): Promise<ProductEditRecord | null> {
  let row: BackendEditRow;
  try {
    row = await backendRequest<BackendEditRow>(`/products/${id}`, { accessToken: await accessToken() });
  } catch (error) {
    if (error instanceof BackendApiError && error.status === 404) {
      return null;
    }
    throw error;
  }

  return {
    sku: row.sku,
    slug: row.slug,
    oemNumbers: row.oemNumbers,
    name: { uz: row.nameUz, ru: row.nameRu, en: row.nameEn },
    description: { uz: row.descriptionUz, ru: row.descriptionRu, en: row.descriptionEn },
    price: row.price === null ? null : Number(row.price),
    stock: row.availableQuantity,
    minStock: row.minStock,
    categoryId: row.categoryId,
    brandId: row.brandId,
    compatibleModels: row.compatibleModels,
    specs: row.specs as ProductWriteInput["specs"],
    isActive: row.isActive,
    imageUrl: row.imageUrl,
  };
}

/** Just enough to know whether a product exists and what it was photographed with. */
export async function findProductImageUrl(id: string): Promise<{ imageUrl: string | null } | null> {
  try {
    const row = await backendRequest<{ imageUrl: string | null }>(`/products/${id}`, {
      accessToken: await accessToken(),
    });
    return { imageUrl: row.imageUrl };
  } catch (error) {
    if (error instanceof BackendApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Sets or replaces a product's photo. Split from `updateProduct` because it is
 * reached from a different route with a different body — multipart, one file
 * — and because a create can call it too, right after the row it points at
 * first exists.
 */
export async function setProductImage(
  id: string,
  imageUrl: string,
  _actorId: string,
): Promise<WriteResult<{ imageUrl: string }>> {
  try {
    await backendRequest(`/products/${id}/image`, {
      method: "PATCH",
      accessToken: await accessToken(),
      body: { imageUrl },
    });
    return { ok: true, value: { imageUrl } };
  } catch (error) {
    if (error instanceof BackendApiError && error.status === 404) {
      return { ok: false, reason: "not_found" };
    }
    throw error;
  }
}
