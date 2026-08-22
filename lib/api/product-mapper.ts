import type {
  Brand as BrandRow,
  Category as CategoryRow,
  Product as PrismaProduct,
} from "@/prisma/generated/prisma/client";
import type { Brand, Category, Product, ProductSpec } from "@/lib/types";

export type ProductRow = PrismaProduct;

/**
 * Maps a database row to the public `Product`.
 *
 * Two things this deliberately drops: `stock` and `minStock` never reach a
 * public payload, and the per-locale columns are folded back into
 * `LocalizedText` so no component has to know how the table is shaped.
 */
export function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    slug: row.slug,
    sku: row.sku,
    oemNumbers: row.oemNumbers,
    name: { uz: row.nameUz, ru: row.nameRu, en: row.nameEn },
    description: { uz: row.descriptionUz, ru: row.descriptionRu, en: row.descriptionEn },
    // Decimal is an object; JSON-serialising it would ship "{s,e,d}" to the client.
    price: row.price === null ? null : row.price.toNumber(),
    categoryId: row.categoryId,
    brandId: row.brandId,
    compatibleModels: row.compatibleModels,
    stockStatus: row.stockStatus,
    specs: row.specs as unknown as ProductSpec[],
    imageLabels: row.imageLabels,
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
