"use client";

import { useQuery } from "@tanstack/react-query";
import { adminKeys } from "@/lib/api/admin/keys";
import {
  fetchGoodsReceipts,
  fetchMovementsReport,
  fetchProductMovements,
  fetchWarehouseProducts,
  fetchWarehouses,
} from "@/lib/api/admin/warehouse";
import type {
  GoodsReceiptPage,
  MovementPage,
  WarehouseProductPage,
} from "@/lib/api/warehouse-repository";
import type {
  GoodsReceiptListQuery,
  MovementsReportQuery,
  ProductMovementsQuery,
  WarehouseProductListQuery,
} from "@/lib/schemas";
import { PANEL_STALE_MS } from "./use-panel-mutation";

/**
 * The warehouse module's read hooks. Same shape as `hooks/admin/use-admin-*`:
 * the page reads the first screen on the server and passes it as `initialData`,
 * the key carries the URL state so a new filter is a new cache entry, and
 * `PANEL_STALE_MS` keeps the server seed from being thrown away on mount.
 */

export function useWarehouseProducts(
  query: WarehouseProductListQuery,
  initialData?: WarehouseProductPage,
) {
  return useQuery({
    queryKey: adminKeys.warehouse.products.list(query),
    queryFn: () => fetchWarehouseProducts(query),
    initialData,
    staleTime: PANEL_STALE_MS,
  });
}

/** The warehouse list, for filter dropdowns and selects. Rarely changes. */
export function useWarehouses() {
  return useQuery({
    queryKey: adminKeys.warehouse.warehouses.list(),
    queryFn: fetchWarehouses,
    staleTime: 5 * 60_000,
  });
}

export function useProductMovements(
  productId: string,
  query: ProductMovementsQuery,
  initialData?: MovementPage,
) {
  return useQuery({
    queryKey: adminKeys.warehouse.products.movements(productId, query),
    queryFn: () => fetchProductMovements(productId, query),
    initialData,
    staleTime: PANEL_STALE_MS,
  });
}

export function useMovementsReport(query: MovementsReportQuery, initialData?: MovementPage) {
  return useQuery({
    queryKey: adminKeys.warehouse.reports.movements(query),
    queryFn: () => fetchMovementsReport(query),
    initialData,
    staleTime: PANEL_STALE_MS,
  });
}

export function useGoodsReceipts(query: GoodsReceiptListQuery, initialData?: GoodsReceiptPage) {
  return useQuery({
    queryKey: adminKeys.warehouse.receipts.list(query),
    queryFn: () => fetchGoodsReceipts(query),
    initialData,
    staleTime: PANEL_STALE_MS,
  });
}
