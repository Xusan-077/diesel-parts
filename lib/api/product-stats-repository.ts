import "server-only";
import { backendRequest } from "./backend-client";
import { EMPTY_STATS, type ProductStats } from "@/lib/product-stats";

interface BackendProductStats {
  productId: string;
  rating: number | null;
  reviewCount: number;
  soldCount: number;
}

/**
 * The rating, review count and units sold for a page of products.
 *
 * One request for the whole page rather than one per card: a nine-card grid
 * would otherwise cost nine round trips, and the numbers are decoration on a
 * listing that must stay fast. backend/'s `GET /catalog/products/stats`
 * (Task 15) does the same two grouped queries this used to run directly.
 */
export async function getProductStats(
  productIds: readonly string[]
): Promise<Map<string, ProductStats>> {
  const stats = new Map<string, ProductStats>();
  if (productIds.length === 0) {
    return stats;
  }

  const rows = await backendRequest<BackendProductStats[]>("/catalog/products/stats", {
    query: { ids: productIds.join(",") },
  });

  for (const row of rows) {
    stats.set(row.productId, {
      rating: row.rating,
      reviewCount: row.reviewCount,
      soldCount: row.soldCount,
    });
  }

  return stats;
}

/**
 * The same figures for one product, as a plain object.
 *
 * A product with nothing to show still returns a record — the detail page
 * renders "no reviews yet" rather than omitting the line, which is the honest
 * answer for a catalog that has just opened.
 */
export async function getProductStatsFor(productId: string): Promise<ProductStats> {
  const stats = await getProductStats([productId]);
  return stats.get(productId) ?? EMPTY_STATS;
}
