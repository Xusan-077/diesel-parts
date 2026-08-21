import type { Product } from "@/lib/types";

export type SortKey = "newest" | "name-asc" | "name-desc";
export type AvailabilityFilter = "all" | Product["stockStatus"];


export function getRelatedProducts(
  product: Product,
  products: Product[],
  count: number = 4
): Product[] {
  return products
    .filter((p) => p.id !== product.id && p.categoryId === product.categoryId)
    .slice(0, count);
}
