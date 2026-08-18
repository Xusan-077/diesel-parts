import { brands } from "@/prisma/seed-data/brands";
import { categories } from "@/prisma/seed-data/categories";
import { products } from "@/prisma/seed-data/products";
import type { Locale } from "@/lib/i18n/locales";
import type { Product } from "@/lib/types";

export interface ResolvedProduct {
  product: Product;
  brandName: string;
  categoryName: string;
}

const productsById = new Map(products.map((product) => [product.id, product]));
const brandsById = new Map(brands.map((brand) => [brand.id, brand]));
const categoriesById = new Map(categories.map((category) => [category.id, category]));

export function resolveProduct(id: string, lang: Locale): ResolvedProduct | null {
  const product = productsById.get(id);
  if (!product) {
    return null;
  }
  return {
    product,
    brandName: brandsById.get(product.brandId)?.name ?? "",
    categoryName: categoriesById.get(product.categoryId)?.name[lang] ?? "",
  };
}

/**
 * Resolves stored ids to products, dropping any that no longer exist — the
 * wishlist and cart live in localStorage and can outlive a catalog change.
 */
export function resolveProducts(ids: readonly string[], lang: Locale): ResolvedProduct[] {
  return ids
    .map((id) => resolveProduct(id, lang))
    .filter((entry): entry is ResolvedProduct => entry !== null);
}
