import type { Brand, Category, Product, ProductSpec, StockStatus } from "@/lib/types";

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
  stockStatus: StockStatus;
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
    stockStatus: row.stockStatus,
    specs: row.specs as ProductSpec[],
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
