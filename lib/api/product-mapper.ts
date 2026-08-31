import type { Brand, Category, Product, ProductSpec, StockStatus } from "@/lib/types";

/** backend/'s raw `Product.stockStatus` enum (backend/prisma/schema.prisma) — not root's own `StockStatus` vocabulary. */
export type BackendStockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

/**
 * backend status -> root status.
 *
 * Same shape as order-repository.ts's toRootStatus()/toBackendStatus() for
 * OrderStatus: backend/'s schema enum and root's storefront-facing StockStatus
 * (lib/types.ts) have never shared a vocabulary (`IN_STOCK` vs `available`,
 * etc.) — every reader of a product's stock status goes through this so the
 * mismatch has exactly one fix point, not one per call site.
 */
export function toRootStockStatus(s: string): StockStatus {
  if (s === "IN_STOCK") return "available";
  if (s === "LOW_STOCK") return "limited";
  return "out_of_stock"; // OUT_OF_STOCK, and any unrecognized value fails safe to "out of stock" rather than "available"
}

/** root status -> backend status (writes / query filters). */
export function toBackendStockStatus(s: StockStatus): BackendStockStatus {
  if (s === "available") return "IN_STOCK";
  if (s === "limited") return "LOW_STOCK";
  return "OUT_OF_STOCK";
}

/** One product row as backend/'s catalog endpoints return it. */
export interface ProductRow {
  id: string;
  slug: string;
  sku: string;
  oemNumbers: string[];
  nameUz: string;
  nameRu: string;
  nameEn: string;
  descriptionUz: string;
  descriptionRu: string;
  descriptionEn: string;
  // Decimal columns serialize as a numeric string over the wire, never a number.
  price: string | null;
  categoryId: string;
  brandId: string;
  compatibleModels: string[];
  specs: unknown;
  imageUrl: string | null;
  stockStatus: BackendStockStatus;
}

export interface CategoryRow {
  id: string;
  slug: string;
  nameUz: string;
  nameRu: string;
  nameEn: string;
  parentId: string | null;
}

export interface BrandRow {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
}

/**
 * Maps backend/'s JSON row to the public `Product`.
 *
 * Two things this deliberately drops: `stock`/`minStock` never reach a public
 * payload, and the per-locale fields are folded back into `LocalizedText` so
 * no component has to know how the row is shaped.
 */
export function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    slug: row.slug,
    sku: row.sku,
    oemNumbers: row.oemNumbers,
    name: { uz: row.nameUz, ru: row.nameRu, en: row.nameEn },
    description: { uz: row.descriptionUz, ru: row.descriptionRu, en: row.descriptionEn },
    price: row.price === null ? null : Number(row.price),
    categoryId: row.categoryId,
    brandId: row.brandId,
    compatibleModels: row.compatibleModels,
    stockStatus: toRootStockStatus(row.stockStatus),
    // backend/'s Product.specs defaults to the JSON object "{}", not "[]" —
    // real (non-default) rows are arrays; guard rather than let a
    // never-edited product's specs crash SpecsTable's .map().
    specs: Array.isArray(row.specs) ? (row.specs as ProductSpec[]) : [],
    imageUrl: row.imageUrl,
  };
}

export function toCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    slug: row.slug,
    name: { uz: row.nameUz, ru: row.nameRu, en: row.nameEn },
    parentId: row.parentId,
  };
}

export function toBrand(row: BrandRow): Brand {
  return { id: row.id, slug: row.slug, name: row.name, logoUrl: row.logoUrl };
}
