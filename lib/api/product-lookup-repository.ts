import "server-only";
import { prisma } from "@/lib/db";
import { deriveStockStatus } from "./stock-status";
import { PRODUCT_SEARCH_LIMIT, PRODUCT_SEARCH_ORDER, sellableProductWhere } from "./product-search";
import type { StockStatus } from "@/lib/types";

/** One catalog row as the order form needs it. */
export interface ProductLookupRow {
  id: string;
  sku: string;
  name: string;
  oemNumbers: string[];
  /** Null for a part priced on request; the seller then types the figure. */
  price: number | null;
  currency: string;
  stock: number;
  stockStatus: StockStatus;
}

/**
 * Searches the catalog for the order form.
 *
 * `stockStatus` is recomputed from `stock` and `minStock` rather than read
 * from the persisted column: the column is correct, but recomputing keeps the
 * form honest if a write path ever forgets `deriveStockStatus`, and it costs a
 * comparison on at most eight rows.
 */
export async function searchSellableProducts(term: string): Promise<ProductLookupRow[]> {
  const rows = await prisma.product.findMany({
    where: sellableProductWhere(term),
    orderBy: PRODUCT_SEARCH_ORDER,
    take: PRODUCT_SEARCH_LIMIT,
    select: {
      id: true,
      sku: true,
      nameUz: true,
      oemNumbers: true,
      price: true,
      currency: true,
      stock: true,
      minStock: true,
    },
  });

  return rows.map((row) => ({
    id: row.id,
    sku: row.sku,
    name: row.nameUz,
    oemNumbers: row.oemNumbers,
    price: row.price === null ? null : Number(row.price),
    currency: row.currency,
    stock: row.stock,
    stockStatus: deriveStockStatus(row.stock, row.minStock),
  }));
}
