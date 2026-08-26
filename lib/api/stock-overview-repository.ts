import "server-only";
import { prisma } from "@/lib/db";
import type { StockStatus } from "@/lib/types";

/**
 * Stock, read as one location.
 *
 * The brief this page was built from asked for a per-warehouse breakdown
 * ("Product × Warehouse A/B"). This app's own schema (prisma/schema.prisma)
 * has no `Warehouse` or per-location `Inventory` model — `Product.stock` is a
 * single number — and the multi-warehouse model that *does* exist
 * (backend/prisma/schema.prisma's `Warehouse`/`Inventory`) belongs to the
 * separate seller-marketplace service, a different database behind a
 * different auth system (see `lib/api/internal-backend.ts`). Reaching into it
 * for a director UI, or adding a real multi-location schema, is a data-model
 * change well past a UI redesign, so this reads the one stock number that is
 * real and organizes the page around `deriveStockStatus()`'s three states
 * instead of a warehouse split that does not exist yet.
 */

export interface StockCounts {
  total: number;
  available: number;
  limited: number;
  outOfStock: number;
}

export async function getStockCounts(): Promise<StockCounts> {
  const rows = await prisma.product.groupBy({
    by: ["stockStatus"],
    where: { isActive: true },
    _count: { _all: true },
  });

  const byStatus = new Map(rows.map((row) => [row.stockStatus, row._count._all]));

  return {
    total: rows.reduce((sum, row) => sum + row._count._all, 0),
    available: byStatus.get("available") ?? 0,
    limited: byStatus.get("limited") ?? 0,
    outOfStock: byStatus.get("out_of_stock") ?? 0,
  };
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

/** Worst stock first — the same ordering `getLowStockProducts()` uses for the dashboard widget. */
export async function listStock(options: {
  status?: StockStatus;
  page: number;
}): Promise<StockPage> {
  const where = {
    isActive: true,
    ...(options.status ? { stockStatus: options.status } : {}),
  };

  const total = await prisma.product.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / STOCK_PAGE_SIZE));
  const page = Math.min(Math.max(1, options.page), totalPages);

  const rows = await prisma.product.findMany({
    where,
    orderBy: { stock: "asc" },
    skip: (page - 1) * STOCK_PAGE_SIZE,
    take: STOCK_PAGE_SIZE,
    select: {
      id: true,
      sku: true,
      nameUz: true,
      stock: true,
      minStock: true,
      stockStatus: true,
      category: { select: { nameUz: true } },
    },
  });

  return {
    items: rows.map((row) => ({
      id: row.id,
      sku: row.sku,
      name: row.nameUz,
      categoryName: row.category?.nameUz ?? "",
      stock: row.stock,
      minStock: row.minStock,
      status: row.stockStatus,
    })),
    total,
    page,
    pageSize: STOCK_PAGE_SIZE,
    totalPages,
  };
}
