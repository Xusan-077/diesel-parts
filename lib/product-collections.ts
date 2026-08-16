import type { Product } from "@/lib/types";

/**
 * Was 4, the width of the old home page grid. The rows scroll now, so the count
 * is set by how far it is worth scrolling rather than by what fits: twelve is
 * three screens at the widest breakpoint, and still short enough that the row
 * ends before the reader does.
 */
export const HOME_ROW_SIZE = 12;

/**
 * Placeholder selectors for the home page rows. The mock catalog carries no
 * sales or popularity data, so each row derives a stable, distinct slice of it.
 * Swap the bodies for real queries without touching the components.
 */

/** Stands in for popularity: the head of the catalog order. */
export function getPopularProducts(
  all: readonly Product[],
  count: number = HOME_ROW_SIZE
): Product[] {
  return all.slice(0, count);
}

/** Stands in for recency: the tail of the catalog order, newest first. */
export function getNewProducts(
  all: readonly Product[],
  count: number = HOME_ROW_SIZE
): Product[] {
  return all.slice(-count).reverse();
}

/** Stands in for sales volume: in-stock items first, then everything else. */
export function getBestSellerProducts(
  all: readonly Product[],
  count: number = HOME_ROW_SIZE
): Product[] {
  const available = all.filter((product) => product.stockStatus === "available");
  const rest = all.filter((product) => product.stockStatus !== "available");
  return [...available, ...rest].slice(0, count);
}
