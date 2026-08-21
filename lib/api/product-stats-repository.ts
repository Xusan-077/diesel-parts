import "server-only";
import { prisma } from "@/lib/db";
import { EMPTY_STATS, type ProductStats } from "@/lib/product-stats";

/**
 * The rating, review count and units sold for a page of products.
 *
 * Two grouped queries for the whole page rather than two per card: a
 * nine-card grid would otherwise cost eighteen round trips, and the numbers
 * are decoration on a listing that must stay fast.
 *
 * Only approved reviews count, so an unmoderated review moves nothing, and
 * only COMPLETED orders count, so a draft a seller is still assembling is not
 * advertised as a sale.
 */
export async function getProductStats(
  productIds: readonly string[]
): Promise<Map<string, ProductStats>> {
  const stats = new Map<string, ProductStats>();
  if (productIds.length === 0) {
    return stats;
  }

  const ids = [...productIds];

  const [reviews, sold] = await Promise.all([
    prisma.review.groupBy({
      by: ["productId"],
      where: { productId: { in: ids }, isApproved: true },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    prisma.orderItem.groupBy({
      by: ["productId"],
      where: { productId: { in: ids }, order: { status: "COMPLETED" } },
      _sum: { qty: true },
    }),
  ]);

  for (const id of ids) {
    stats.set(id, EMPTY_STATS);
  }

  for (const row of reviews) {
    const average = row._avg.rating;
    stats.set(row.productId, {
      ...(stats.get(row.productId) ?? EMPTY_STATS),
      // Postgres returns the mean at full precision; the card shows one decimal.
      rating: average === null ? null : Math.round(average * 10) / 10,
      reviewCount: row._count._all,
    });
  }

  for (const row of sold) {
    stats.set(row.productId, {
      ...(stats.get(row.productId) ?? EMPTY_STATS),
      soldCount: row._sum.qty ?? 0,
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
