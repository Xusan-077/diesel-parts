import "server-only";
import { backendRequest } from "./backend-client";
import { getStaffSession } from "@/lib/auth/staff-session";
import { toRootStockStatus, type BackendStockStatus } from "./product-mapper";
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

interface BackendLookupRow {
  id: string;
  sku: string;
  name: string;
  oemNumbers: string[];
  price: string | null;
  currency: string;
  stock: number;
  stockStatus: BackendStockStatus;
}

/**
 * Searches the catalog for the order form, via backend/'s `GET
 * /products/search` (widened from MANAGER_UP to every staff role in Part 1
 * Task 8's follow-up, since raising an order is a seller's job).
 */
export async function searchSellableProducts(term: string): Promise<ProductLookupRow[]> {
  const session = await getStaffSession();
  const rows = await backendRequest<BackendLookupRow[]>("/products/search", {
    accessToken: session?.accessToken,
    query: { q: term },
  });

  return rows.map((row) => ({
    ...row,
    price: row.price === null ? null : Number(row.price),
    stockStatus: toRootStockStatus(row.stockStatus),
  }));
}
