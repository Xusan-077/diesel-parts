"use client";

import { useQuery } from "@tanstack/react-query";
import { adminKeys } from "@/lib/api/admin/keys";
import {
  approveGoodsReceipt,
  cancelGoodsReceipt,
  createGoodsReceipt,
  createWarehouse,
  deleteWarehouse,
  fetchGoodsReceipt,
  fetchGoodsReceipts,
  fetchMovementsReport,
  fetchProductMovements,
  fetchWarehouse,
  fetchWarehouseProducts,
  fetchWarehouses,
  updateGoodsReceipt,
  updateWarehouse,
} from "@/lib/api/admin/warehouse";
import type {
  GoodsReceiptDetail,
  GoodsReceiptPage,
  MovementPage,
  WarehouseDetail,
  WarehouseProductPage,
  WarehouseRow,
} from "@/lib/api/warehouse-repository";
import type {
  GoodsReceiptListQuery,
  GoodsReceiptWriteInput,
  MovementsReportQuery,
  ProductMovementsQuery,
  WarehouseProductListQuery,
  WarehouseWriteInput,
} from "@/lib/schemas";
import { PANEL_STALE_MS, usePanelMutation } from "./use-panel-mutation";

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

/** The warehouse list, for filter dropdowns and the warehouses page. */
export function useWarehouses(initialData?: WarehouseRow[]) {
  return useQuery({
    queryKey: adminKeys.warehouse.warehouses.list(),
    queryFn: fetchWarehouses,
    initialData,
    staleTime: PANEL_STALE_MS,
  });
}

export function useWarehouse(id: string, initialData?: WarehouseDetail) {
  return useQuery({
    queryKey: adminKeys.warehouse.warehouses.detail(id),
    queryFn: () => fetchWarehouse(id),
    initialData,
    staleTime: PANEL_STALE_MS,
  });
}

/*
 * The form pins a refusal to the field it belongs to (a taken code under the
 * code box) and says its own piece on success, so neither write carries a
 * toast. `warehouse.all` is the prefix over products / movements / dashboard
 * too — a renamed or closed warehouse shows everywhere at once.
 */
export function useCreateWarehouse() {
  return usePanelMutation<WarehouseWriteInput, WarehouseRow>({
    run: createWarehouse,
    invalidates: [adminKeys.warehouse.all],
  });
}

export function useUpdateWarehouse() {
  return usePanelMutation<{ id: string; values: WarehouseWriteInput }, WarehouseRow>({
    run: ({ id, values }) => updateWarehouse(id, values),
    invalidates: [adminKeys.warehouse.all],
  });
}

export function useDeleteWarehouse(onDone?: () => void) {
  return usePanelMutation<{ id: string }, void>({
    run: ({ id }) => deleteWarehouse(id),
    invalidates: [adminKeys.warehouse.all],
    success: "Ombor o'chirildi",
    // No failure toast: the confirm dialog keeps the reason inside itself —
    // a warehouse still holding stock cannot be deleted, and that sentence
    // belongs next to the button that was pressed.
    onDone,
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

export function useGoodsReceipt(id: string, initialData?: GoodsReceiptDetail) {
  return useQuery({
    queryKey: adminKeys.warehouse.receipts.detail(id),
    queryFn: () => fetchGoodsReceipt(id),
    initialData,
    staleTime: PANEL_STALE_MS,
  });
}

/*
 * Create and edit carry no toast — the form pins field refusals and announces
 * its own success. Approve and cancel do: they are one-click actions from a
 * detail page, and the outcome ("stock moved" / "cancelled") is the whole
 * point. Approval touches inventory, so it invalidates the module-wide prefix.
 */
export function useCreateGoodsReceipt() {
  return usePanelMutation<GoodsReceiptWriteInput, GoodsReceiptDetail>({
    run: createGoodsReceipt,
    invalidates: [adminKeys.warehouse.receipts.all],
  });
}

export function useUpdateGoodsReceipt() {
  return usePanelMutation<{ id: string; values: GoodsReceiptWriteInput }, GoodsReceiptDetail>({
    run: ({ id, values }) => updateGoodsReceipt(id, values),
    invalidates: [adminKeys.warehouse.receipts.all],
  });
}

export function useApproveGoodsReceipt(onDone?: () => void) {
  return usePanelMutation<{ id: string }, GoodsReceiptDetail>({
    run: ({ id }) => approveGoodsReceipt(id),
    invalidates: [adminKeys.warehouse.all],
    success: "Qabul tasdiqlandi — qoldiqlar yangilandi",
    onDone,
  });
}

export function useCancelGoodsReceipt(onDone?: () => void) {
  return usePanelMutation<{ id: string }, GoodsReceiptDetail>({
    run: ({ id }) => cancelGoodsReceipt(id),
    invalidates: [adminKeys.warehouse.receipts.all],
    success: "Qabul bekor qilindi",
    onDone,
  });
}
