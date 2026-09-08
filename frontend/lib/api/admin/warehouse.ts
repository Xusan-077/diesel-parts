import { panelClient } from "./client";
import type {
  GoodsReceiptListQuery,
  GoodsReceiptWriteInput,
  MovementsReportQuery,
  ProductMovementsQuery,
  WarehouseProductListQuery,
  WarehouseWriteInput,
} from "@/lib/schemas";
import type {
  GoodsReceiptDetail,
  GoodsReceiptPage,
  MovementPage,
  WarehouseDetail,
  WarehouseProductPage,
  WarehouseRow,
} from "@/lib/api/warehouse-repository";

/**
 * Every warehouse request the browser makes, typed once — the client-side
 * counterpart to `lib/api/warehouse-repository.ts` (which is the server's).
 * Each hits an `/api/v1/warehouse/*` route that authenticates and proxies to
 * `backend/`; a component never spells one of these URLs.
 */

interface Envelope {
  success?: boolean;
}

export async function fetchWarehouseProducts(
  query: WarehouseProductListQuery,
): Promise<WarehouseProductPage> {
  const { data } = await panelClient.get<WarehouseProductPage & Envelope>("/warehouse/products", {
    params: {
      q: query.q || undefined,
      status: query.status,
      warehouseId: query.warehouseId,
      page: query.page,
    },
  });
  return data;
}

export async function fetchWarehouses(): Promise<WarehouseRow[]> {
  const { data } = await panelClient.get<{ warehouses: WarehouseRow[] } & Envelope>(
    "/warehouse/warehouses",
  );
  return data.warehouses;
}

export async function fetchWarehouse(id: string): Promise<WarehouseDetail> {
  const { data } = await panelClient.get<{ warehouse: WarehouseDetail } & Envelope>(
    `/warehouse/warehouses/${id}`,
  );
  return data.warehouse;
}

export async function createWarehouse(input: WarehouseWriteInput): Promise<WarehouseRow> {
  const { data } = await panelClient.post<{ warehouse: WarehouseRow } & Envelope>(
    "/warehouse/warehouses",
    input,
  );
  return data.warehouse;
}

export async function updateWarehouse(
  id: string,
  input: WarehouseWriteInput,
): Promise<WarehouseRow> {
  const { data } = await panelClient.patch<{ warehouse: WarehouseRow } & Envelope>(
    `/warehouse/warehouses/${id}`,
    input,
  );
  return data.warehouse;
}

export async function deleteWarehouse(id: string): Promise<void> {
  await panelClient.delete(`/warehouse/warehouses/${id}`);
}

export async function fetchProductMovements(
  productId: string,
  query: ProductMovementsQuery,
): Promise<MovementPage> {
  const { data } = await panelClient.get<MovementPage & Envelope>(
    `/warehouse/products/${productId}/movements`,
    { params: { warehouseId: query.warehouseId, type: query.type, page: query.page } },
  );
  return data;
}

export async function fetchMovementsReport(query: MovementsReportQuery): Promise<MovementPage> {
  const { data } = await panelClient.get<MovementPage & Envelope>("/warehouse/reports/movements", {
    params: {
      warehouseId: query.warehouseId,
      productId: query.productId,
      type: query.type,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      page: query.page,
    },
  });
  return data;
}

export async function fetchGoodsReceipts(
  query: GoodsReceiptListQuery,
): Promise<GoodsReceiptPage> {
  const { data } = await panelClient.get<GoodsReceiptPage & Envelope>("/warehouse/goods-receipts", {
    params: {
      q: query.q || undefined,
      status: query.status,
      warehouseId: query.warehouseId,
      page: query.page,
    },
  });
  return data;
}

export async function fetchGoodsReceipt(id: string): Promise<GoodsReceiptDetail> {
  const { data } = await panelClient.get<{ receipt: GoodsReceiptDetail } & Envelope>(
    `/warehouse/goods-receipts/${id}`,
  );
  return data.receipt;
}

export async function createGoodsReceipt(
  input: GoodsReceiptWriteInput,
): Promise<GoodsReceiptDetail> {
  const { data } = await panelClient.post<{ receipt: GoodsReceiptDetail } & Envelope>(
    "/warehouse/goods-receipts",
    input,
  );
  return data.receipt;
}

export async function updateGoodsReceipt(
  id: string,
  input: GoodsReceiptWriteInput,
): Promise<GoodsReceiptDetail> {
  const { data } = await panelClient.patch<{ receipt: GoodsReceiptDetail } & Envelope>(
    `/warehouse/goods-receipts/${id}`,
    input,
  );
  return data.receipt;
}

export async function approveGoodsReceipt(id: string): Promise<GoodsReceiptDetail> {
  const { data } = await panelClient.post<{ receipt: GoodsReceiptDetail } & Envelope>(
    `/warehouse/goods-receipts/${id}/approve`,
  );
  return data.receipt;
}

export async function cancelGoodsReceipt(id: string): Promise<GoodsReceiptDetail> {
  const { data } = await panelClient.post<{ receipt: GoodsReceiptDetail } & Envelope>(
    `/warehouse/goods-receipts/${id}/cancel`,
  );
  return data.receipt;
}
