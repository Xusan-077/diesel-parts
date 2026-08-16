import { products } from "@/lib/data/products";
import { filterProducts, sortProducts } from "@/lib/filters";
import type { Product } from "@/lib/types";
import { paginate, type Page, type ProductQuery } from "./product-query";

/**
 * The single place product data is read from.
 *
 * Server components and route handlers both call this directly — the server
 * never issues an HTTP request to its own API. The browser reaches the same
 * code through `/api/products` via `lib/api/products.ts`.
 *
 * Replacing the mock catalog with a database means changing only this file.
 */
export function queryProducts(query: ProductQuery): Page<Product> {
  const filtered = filterProducts(
    products,
    {
      search: query.q,
      brandId: query.brandId,
      categoryId: query.categoryId,
      categoryIds: query.categoryIds,
      availability: query.availability,
    },
    query.lang
  );

  const sorted = sortProducts(filtered, query.sort, query.lang);
  return paginate(sorted, query.page, query.pageSize);
}

export function getProductBySlug(slug: string): Product | null {
  return products.find((candidate) => candidate.slug === slug) ?? null;
}
