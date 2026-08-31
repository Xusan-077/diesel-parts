import type { StockStatus } from "@/lib/types";

/**
 * The single definition of what a stock number means.
 *
 * Persisted into `Product.stockStatus` by every write path rather than
 * evaluated in a `where` clause: the query-time form needs `stock > minStock`,
 * a column-to-column comparison, and the persisted column is also indexable.
 * Every writer must call this instead of setting the column directly.
 */
export function deriveStockStatus(stock: number, minStock: number): StockStatus {
  if (stock <= 0) {
    return "out_of_stock";
  }
  if (stock <= minStock) {
    return "limited";
  }
  return "available";
}
