import type { Product } from "@/lib/types";
import type { Locale } from "@/lib/i18n/locales";

export type SortKey = "newest" | "name-asc" | "name-desc";
export type AvailabilityFilter = "all" | Product["stockStatus"];

export interface ProductFiltersInput {
  search?: string;
  brandId?: string;
  categoryId?: string;
  /**
   * Restricts the pool to these category ids, used by the catalog menu scope.
   * An empty array matches nothing — a menu entry with no products yet.
   */
  categoryIds?: string[];
  availability?: AvailabilityFilter;
}

export function filterProducts(
  products: Product[],
  filters: ProductFiltersInput,
  lang: Locale
): Product[] {
  const search = filters.search?.trim().toLowerCase() ?? "";

  return products.filter((product) => {
    if (filters.brandId && filters.brandId !== "all" && product.brandId !== filters.brandId) {
      return false;
    }
    if (filters.categoryId && filters.categoryId !== "all" && product.categoryId !== filters.categoryId) {
      return false;
    }
    if (filters.categoryIds && !filters.categoryIds.includes(product.categoryId)) {
      return false;
    }
    if (filters.availability && filters.availability !== "all" && product.stockStatus !== filters.availability) {
      return false;
    }
    if (search) {
      const haystack = [product.name[lang], product.sku, product.oemNumber].join(" ").toLowerCase();
      if (!haystack.includes(search)) {
        return false;
      }
    }
    return true;
  });
}

export function sortProducts(products: Product[], sortKey: SortKey, lang: Locale): Product[] {
  const sorted = [...products];
  if (sortKey === "name-asc") {
    sorted.sort((a, b) => a.name[lang].localeCompare(b.name[lang]));
  } else if (sortKey === "name-desc") {
    sorted.sort((a, b) => b.name[lang].localeCompare(a.name[lang]));
  }
  return sorted;
}

export function getRelatedProducts(
  product: Product,
  products: Product[],
  count: number = 4
): Product[] {
  return products
    .filter((p) => p.id !== product.id && p.categoryId === product.categoryId)
    .slice(0, count);
}
