import "server-only";
import { backendRequest } from "./backend-client";
import { getStaffSession } from "@/lib/auth/staff-session";
import { toBackendStockStatus, toRootStockStatus, type BackendStockStatus } from "./product-mapper";
import type { StockStatus } from "@/lib/types";

/**
 * Stock, read from backend/'s real warehouse model.
 *
 * Root's own schema never had a `Warehouse`/`Inventory` model — `Product.stock`
 * was a single number — while backend/'s did, computed from `Inventory` rows
 * per warehouse (see the consolidation plan's Global Constraints). Now that
 * backend/ is the one database, this reads its computed `availableQuantity`
 * and `stockStatus` instead of the column this app used to keep in sync by
 * hand; there is still no per-warehouse breakdown surfaced here, matching the
 * page this was always built for.
 */

export interface StockCounts {
  total: number;
  available: number;
  limited: number;
  outOfStock: number;
}

interface BackendStockRow {
  id: string;
  sku: string;
  nameUz: string;
  availableQuantity: number;
  minStock: number;
  stockStatus: BackendStockStatus;
  category: { nameUz: string } | null;
}

async function accessToken(): Promise<string | undefined> {
  const session = await getStaffSession();
  return session?.accessToken;
}

/**
 * Counted from one full-catalog read (capped at backend/'s 100-row page
 * limit) rather than a dedicated aggregate endpoint — `stockStatus` is
 * computed, not a column, so backend/ can't `groupBy` it in SQL either; this
 * catalog is well under that cap today.
 */
export async function getStockCounts(): Promise<StockCounts> {
  const result = await backendRequest<{ data: BackendStockRow[] }>("/products", {
    accessToken: await accessToken(),
    query: { isActive: "true", limit: 100 },
  });

  const counts = { total: 0, available: 0, limited: 0, outOfStock: 0 };
  for (const row of result.data) {
    counts.total += 1;
    const status = toRootStockStatus(row.stockStatus);
    if (status === "available") counts.available += 1;
    else if (status === "limited") counts.limited += 1;
    else counts.outOfStock += 1;
  }
  return counts;
}

export interface StockRow {
  id: string;
  sku: string;
  name: string;
  categoryName: string;
  stock: number;
  minStock: number;
  status: StockStatus;
}

export interface StockPage {
  items: StockRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const STOCK_PAGE_SIZE = 20;

/**
 * Worst stock first.
 *
 * Filtering, sorting and paging all happen inside backend/'s own
 * `findAllAdmin` (stockStatus filtered and stock-sorted before the page is
 * sliced), so this can pass the request straight through rather than
 * fetching everything and paginating here.
 */
export async function listStock(options: {
  status?: StockStatus;
  page: number;
}): Promise<StockPage> {
  const result = await backendRequest<{
    data: BackendStockRow[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }>("/products", {
    accessToken: await accessToken(),
    query: {
      isActive: "true",
      stockStatus: options.status ? toBackendStockStatus(options.status) : undefined,
      sort: "stock",
      page: options.page,
      limit: STOCK_PAGE_SIZE,
    },
  });

  return {
    items: result.data.map((row) => ({
      id: row.id,
      sku: row.sku,
      name: row.nameUz,
      categoryName: row.category?.nameUz ?? "",
      stock: row.availableQuantity,
      minStock: row.minStock,
      status: toRootStockStatus(row.stockStatus),
    })),
    total: result.meta.total,
    page: result.meta.page,
    pageSize: result.meta.limit,
    totalPages: result.meta.totalPages,
  };
}
