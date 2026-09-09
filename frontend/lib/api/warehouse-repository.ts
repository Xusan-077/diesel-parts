import "server-only";
import { backendRequest } from "./backend-client";
import { getStaffSession } from "@/lib/auth/staff-session";
import type { StockStatus } from "@/lib/types";
import type {
  GoodsReceiptListQuery,
  GoodsReceiptWriteInput,
  MovementsReportQuery,
  ProductMovementsQuery,
  WarehouseProductListQuery,
  WarehouseWriteInput,
} from "@/lib/schemas";

/**
 * The director panel's window onto `backend/`'s warehouse module
 * (`backend/src/warehouse/**`, `backend/src/warehouses`). Every call is a
 * signed-in director's request, so it carries the staff `accessToken` the
 * same way `stock-overview-repository.ts` does; reads are `SELLER_UP` and
 * writes `MANAGER_UP` on the backend, and a director is neither-nor-above both.
 *
 * Phase 1: goods receipts are the only stock-in path. Write-offs, transfers
 * and inventory counts have a stable ledger vocabulary reserved
 * (`StockMovementType`) but no endpoint yet — the panel shows them as "Tez
 * orada", never as a working control.
 */

export type WarehouseMovementType =
  | "IN"
  | "OUT"
  | "RESERVE"
  | "RELEASE"
  | "PURCHASE"
  | "WRITE_OFF"
  | "TRANSFER_IN"
  | "TRANSFER_OUT"
  | "INVENTORY_ADJUSTMENT";

export type GoodsReceiptStatus = "DRAFT" | "APPROVED" | "CANCELLED";
export type WarehouseStatus = "ACTIVE" | "INACTIVE";

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const EMPTY_META: PageMeta = { page: 1, pageSize: 20, total: 0, totalPages: 1 };

interface BackendMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function toMeta(meta: BackendMeta | undefined): PageMeta {
  if (!meta) return EMPTY_META;
  return { page: meta.page, pageSize: meta.limit, total: meta.total, totalPages: meta.totalPages };
}

async function accessToken(): Promise<string | undefined> {
  const session = await getStaffSession();
  return session?.accessToken;
}

/* ── Warehouse products ──────────────────────────────────────────────────── */

interface BackendWarehouseProduct {
  id: string;
  sku: string;
  barcode: string | null;
  nameUz: string;
  unit: string;
  minStock: number;
  oemNumbers: string[];
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  stockStatus: StockStatus;
  stockValue: number;
  averageCost: number | null;
  lastPurchaseCost: number | null;
  purchasePrice: number | null;
  category: { id: string; nameUz: string } | null;
  brand: { id: string; name: string } | null;
}

export interface WarehouseProductRow {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  unit: string;
  minStock: number;
  oemNumbers: string[];
  categoryName: string;
  brandName: string;
  onHand: number;
  reserved: number;
  available: number;
  status: StockStatus;
  stockValue: number;
  /** Best cost per unit available — average, else last purchase, else list. */
  unitCost: number | null;
}

export interface WarehouseProductPage {
  items: WarehouseProductRow[];
  meta: PageMeta;
  /** `"warehouse"` when the figures are scoped to one warehouse, else `"all"`. */
  scope: "warehouse" | "all";
}

function toProductRow(row: BackendWarehouseProduct): WarehouseProductRow {
  return {
    id: row.id,
    sku: row.sku,
    barcode: row.barcode,
    name: row.nameUz,
    unit: row.unit,
    minStock: row.minStock,
    oemNumbers: row.oemNumbers ?? [],
    categoryName: row.category?.nameUz ?? "",
    brandName: row.brand?.name ?? "",
    onHand: row.quantity,
    reserved: row.reservedQuantity,
    available: row.availableQuantity,
    status: row.stockStatus,
    stockValue: row.stockValue,
    unitCost: row.averageCost ?? row.lastPurchaseCost ?? row.purchasePrice ?? null,
  };
}

export async function listWarehouseProducts(
  query: WarehouseProductListQuery,
): Promise<WarehouseProductPage> {
  const result = await backendRequest<{
    data: BackendWarehouseProduct[];
    meta: BackendMeta;
    scope: "warehouse" | "all";
  }>("/warehouse/products", {
    accessToken: await accessToken(),
    query: {
      q: query.q || undefined,
      status: query.status,
      warehouseId: query.warehouseId,
      page: query.page,
      limit: 20,
    },
  });

  return {
    items: result.data.map(toProductRow),
    meta: toMeta(result.meta),
    scope: result.scope ?? "all",
  };
}

export interface WarehouseBreakdownRow {
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  onHand: number;
  reserved: number;
  available: number;
  unitCost: number | null;
}

export interface WarehouseProductDetail extends WarehouseProductRow {
  byWarehouse: WarehouseBreakdownRow[];
}

export async function getWarehouseProduct(
  id: string,
  warehouseId?: string,
): Promise<WarehouseProductDetail> {
  const row = await backendRequest<
    BackendWarehouseProduct & {
      byWarehouse: {
        warehouseId: string;
        warehouseCode: string;
        warehouseName: string;
        quantity: number;
        reservedQuantity: number;
        availableQuantity: number;
        averageCost: number | null;
      }[];
    }
  >(`/warehouse/products/${id}`, {
    accessToken: await accessToken(),
    query: { warehouseId },
  });

  return {
    ...toProductRow(row),
    byWarehouse: row.byWarehouse.map((inv) => ({
      warehouseId: inv.warehouseId,
      warehouseCode: inv.warehouseCode,
      warehouseName: inv.warehouseName,
      onHand: inv.quantity,
      reserved: inv.reservedQuantity,
      available: inv.availableQuantity,
      unitCost: inv.averageCost,
    })),
  };
}

/* ── Stock ledger ────────────────────────────────────────────────────────── */

interface BackendMovement {
  id: string;
  type: WarehouseMovementType;
  quantity: number;
  balanceAfter: number;
  unitCost: number | null;
  reason: string | null;
  referenceType: string | null;
  referenceId: string | null;
  warehouseId: string | null;
  warehouseCode: string;
  warehouseName: string;
  productId?: string;
  productSku?: string;
  productName?: string;
  createdBy: { id: string; name: string } | null;
  createdAt: string;
}

export interface MovementRow {
  id: string;
  type: WarehouseMovementType;
  quantity: number;
  balanceAfter: number;
  unitCost: number | null;
  reason: string | null;
  warehouseCode: string;
  warehouseName: string;
  productId: string | null;
  productSku: string | null;
  productName: string | null;
  actorName: string | null;
  createdAt: string;
}

export interface MovementPage {
  items: MovementRow[];
  meta: PageMeta;
}

function toMovementRow(row: BackendMovement): MovementRow {
  return {
    id: row.id,
    type: row.type,
    quantity: row.quantity,
    balanceAfter: row.balanceAfter,
    unitCost: row.unitCost,
    reason: row.reason,
    warehouseCode: row.warehouseCode,
    warehouseName: row.warehouseName,
    productId: row.productId ?? null,
    productSku: row.productSku ?? null,
    productName: row.productName ?? null,
    actorName: row.createdBy?.name ?? null,
    createdAt: row.createdAt,
  };
}

export async function listProductMovements(
  id: string,
  query: ProductMovementsQuery,
): Promise<MovementPage> {
  const result = await backendRequest<{ data: BackendMovement[]; meta: BackendMeta }>(
    `/warehouse/products/${id}/movements`,
    {
      accessToken: await accessToken(),
      query: { warehouseId: query.warehouseId, type: query.type, page: query.page, limit: 20 },
    },
  );
  return { items: result.data.map(toMovementRow), meta: toMeta(result.meta) };
}

export async function listMovementsReport(query: MovementsReportQuery): Promise<MovementPage> {
  const result = await backendRequest<{ data: BackendMovement[]; meta: BackendMeta }>(
    "/warehouse/reports/movements",
    {
      accessToken: await accessToken(),
      query: {
        warehouseId: query.warehouseId,
        productId: query.productId,
        type: query.type,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        page: query.page,
        limit: 20,
      },
    },
  );
  return { items: result.data.map(toMovementRow), meta: toMeta(result.meta) };
}

/* ── Warehouses ──────────────────────────────────────────────────────────── */

interface BackendWarehouse {
  id: string;
  name: string;
  code: string;
  location: string | null;
  address: string | null;
  status: WarehouseStatus;
  managerId: string | null;
  manager: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface WarehouseRow {
  id: string;
  name: string;
  code: string;
  address: string;
  status: WarehouseStatus;
  managerId: string | null;
  managerName: string;
  createdAt: string;
}

export interface WarehouseDetail extends WarehouseRow {
  stockSummary: { skuCount: number; totalQuantity: number; stockValue: number };
}

function toWarehouseRow(w: BackendWarehouse): WarehouseRow {
  return {
    id: w.id,
    name: w.name,
    code: w.code,
    address: w.address ?? w.location ?? "",
    status: w.status,
    managerId: w.managerId,
    managerName: w.manager?.name ?? "",
    createdAt: w.createdAt,
  };
}

export async function listWarehouses(status?: WarehouseStatus): Promise<WarehouseRow[]> {
  const rows = await backendRequest<BackendWarehouse[]>("/warehouses", {
    accessToken: await accessToken(),
    query: { status },
  });
  return rows.map(toWarehouseRow);
}

export async function getWarehouse(id: string): Promise<WarehouseDetail> {
  const w = await backendRequest<
    BackendWarehouse & { stockSummary: { skuCount: number; totalQuantity: number; stockValue: number } }
  >(`/warehouses/${id}`, { accessToken: await accessToken() });
  return { ...toWarehouseRow(w), stockSummary: w.stockSummary };
}

export async function createWarehouse(input: WarehouseWriteInput): Promise<WarehouseRow> {
  const w = await backendRequest<BackendWarehouse>("/warehouses", {
    method: "POST",
    accessToken: await accessToken(),
    body: {
      name: input.name,
      code: input.code || undefined,
      address: input.address || undefined,
      managerId: input.managerId || undefined,
      status: input.status,
    },
  });
  return toWarehouseRow(w);
}

export async function updateWarehouse(
  id: string,
  input: WarehouseWriteInput,
): Promise<WarehouseRow> {
  const w = await backendRequest<BackendWarehouse>(`/warehouses/${id}`, {
    method: "PATCH",
    accessToken: await accessToken(),
    body: {
      name: input.name,
      code: input.code || undefined,
      address: input.address ?? "",
      managerId: input.managerId || undefined,
      status: input.status,
    },
  });
  return toWarehouseRow(w);
}

export async function deleteWarehouse(id: string): Promise<void> {
  await backendRequest<{ success: true }>(`/warehouses/${id}`, {
    method: "DELETE",
    accessToken: await accessToken(),
  });
}

/* ── Goods receipts ──────────────────────────────────────────────────────── */

interface BackendReceipt {
  id: string;
  receiptNumber: string;
  warehouseId: string;
  supplierName: string | null;
  note: string | null;
  status: GoodsReceiptStatus;
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
  createdAt: string;
  approvedAt: string | null;
  warehouse: { id: string; name: string; code: string };
  createdBy: { id: string; name: string } | null;
  approvedBy: { id: string; name: string } | null;
  items: {
    id: string;
    productId: string;
    quantity: number;
    unitCost: string;
    lineTotal: string;
    product: { id: string; sku: string; nameUz: string; unit: string };
  }[];
}

export interface GoodsReceiptRow {
  id: string;
  receiptNumber: string;
  warehouseCode: string;
  warehouseName: string;
  supplierName: string;
  status: GoodsReceiptStatus;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  itemCount: number;
  createdByName: string;
  approvedByName: string;
  createdAt: string;
  approvedAt: string | null;
}

export interface GoodsReceiptLine {
  id: string;
  productId: string;
  productSku: string;
  productName: string;
  unit: string;
  quantity: number;
  unitCost: number;
  lineTotal: number;
}

export interface GoodsReceiptDetail extends GoodsReceiptRow {
  note: string;
  warehouseId: string;
  lines: GoodsReceiptLine[];
}

function toReceiptRow(r: BackendReceipt): GoodsReceiptRow {
  return {
    id: r.id,
    receiptNumber: r.receiptNumber,
    warehouseCode: r.warehouse.code,
    warehouseName: r.warehouse.name,
    supplierName: r.supplierName ?? "",
    status: r.status,
    subtotal: Number(r.subtotal),
    discount: Number(r.discount),
    tax: Number(r.tax),
    total: Number(r.total),
    itemCount: r.items?.length ?? 0,
    createdByName: r.createdBy?.name ?? "",
    approvedByName: r.approvedBy?.name ?? "",
    createdAt: r.createdAt,
    approvedAt: r.approvedAt,
  };
}

function toReceiptDetail(r: BackendReceipt): GoodsReceiptDetail {
  return {
    ...toReceiptRow(r),
    note: r.note ?? "",
    warehouseId: r.warehouseId,
    lines: r.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productSku: item.product.sku,
      productName: item.product.nameUz,
      unit: item.product.unit,
      quantity: item.quantity,
      unitCost: Number(item.unitCost),
      lineTotal: Number(item.lineTotal),
    })),
  };
}

export interface GoodsReceiptPage {
  items: GoodsReceiptRow[];
  meta: PageMeta;
}

export async function listGoodsReceipts(
  query: GoodsReceiptListQuery,
): Promise<GoodsReceiptPage> {
  const result = await backendRequest<{ data: BackendReceipt[]; meta: BackendMeta }>(
    "/warehouse/goods-receipts",
    {
      accessToken: await accessToken(),
      query: {
        q: query.q || undefined,
        status: query.status,
        warehouseId: query.warehouseId,
        page: query.page,
        limit: 20,
      },
    },
  );
  return { items: result.data.map(toReceiptRow), meta: toMeta(result.meta) };
}

export async function getGoodsReceipt(id: string): Promise<GoodsReceiptDetail> {
  const r = await backendRequest<BackendReceipt>(`/warehouse/goods-receipts/${id}`, {
    accessToken: await accessToken(),
  });
  return toReceiptDetail(r);
}

export async function createGoodsReceipt(
  input: GoodsReceiptWriteInput,
): Promise<GoodsReceiptDetail> {
  const r = await backendRequest<BackendReceipt>("/warehouse/goods-receipts", {
    method: "POST",
    accessToken: await accessToken(),
    body: {
      warehouseId: input.warehouseId,
      supplierName: input.supplierName || undefined,
      note: input.note || undefined,
      discount: input.discount || undefined,
      tax: input.tax || undefined,
      items: input.items.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        unitCost: line.unitCost,
      })),
    },
  });
  return toReceiptDetail(r);
}

export async function updateGoodsReceipt(
  id: string,
  input: GoodsReceiptWriteInput,
): Promise<GoodsReceiptDetail> {
  const r = await backendRequest<BackendReceipt>(`/warehouse/goods-receipts/${id}`, {
    method: "PATCH",
    accessToken: await accessToken(),
    body: {
      warehouseId: input.warehouseId,
      supplierName: input.supplierName || undefined,
      note: input.note || undefined,
      discount: input.discount,
      tax: input.tax,
      items: input.items.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        unitCost: line.unitCost,
      })),
    },
  });
  return toReceiptDetail(r);
}

export async function approveGoodsReceipt(id: string): Promise<GoodsReceiptDetail> {
  const r = await backendRequest<BackendReceipt>(`/warehouse/goods-receipts/${id}/approve`, {
    method: "POST",
    accessToken: await accessToken(),
  });
  return toReceiptDetail(r);
}

export async function cancelGoodsReceipt(id: string): Promise<GoodsReceiptDetail> {
  const r = await backendRequest<BackendReceipt>(`/warehouse/goods-receipts/${id}/cancel`, {
    method: "POST",
    accessToken: await accessToken(),
  });
  return toReceiptDetail(r);
}

/* ── Reports ─────────────────────────────────────────────────────────────── */

export interface StockReportRow {
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  skuCount: number;
  onHand: number;
  reserved: number;
  stockValue: number;
}

export interface StockReport {
  rows: StockReportRow[];
  totals: { skuCount: number; onHand: number; reserved: number; stockValue: number };
}

export async function getStockReport(warehouseId?: string): Promise<StockReport> {
  const result = await backendRequest<{
    data: {
      warehouseId: string;
      warehouseCode: string;
      warehouseName: string;
      skuCount: number;
      quantity: number;
      reservedQuantity: number;
      stockValue: number;
    }[];
    totals: { skuCount: number; quantity: number; reservedQuantity: number; stockValue: number };
  }>("/warehouse/reports/stock", { accessToken: await accessToken(), query: { warehouseId } });

  return {
    rows: result.data.map((row) => ({
      warehouseId: row.warehouseId,
      warehouseCode: row.warehouseCode,
      warehouseName: row.warehouseName,
      skuCount: row.skuCount,
      onHand: row.quantity,
      reserved: row.reservedQuantity,
      stockValue: row.stockValue,
    })),
    totals: {
      skuCount: result.totals.skuCount,
      onHand: result.totals.quantity,
      reserved: result.totals.reservedQuantity,
      stockValue: result.totals.stockValue,
    },
  };
}

export interface LowStockRow {
  productId: string;
  sku: string;
  name: string;
  unit: string;
  warehouseCode: string;
  warehouseName: string;
  onHand: number;
  available: number;
  minStock: number;
  recommendedStock: number;
  shortBy: number;
  status: StockStatus;
  unitCost: number;
  stockValue: number;
}

export async function getLowStockReport(warehouseId?: string): Promise<LowStockRow[]> {
  const result = await backendRequest<{
    data: {
      productId: string;
      sku: string;
      name: string;
      unit: string;
      warehouseCode: string;
      warehouseName: string;
      quantity: number;
      availableQuantity: number;
      minStock: number;
      recommendedStock: number;
      shortBy: number;
      status: StockStatus;
      unitCost: number;
      stockValue: number;
    }[];
  }>("/warehouse/reports/low-stock", { accessToken: await accessToken(), query: { warehouseId } });

  return result.data.map((row) => ({
    productId: row.productId,
    sku: row.sku,
    name: row.name,
    unit: row.unit,
    warehouseCode: row.warehouseCode,
    warehouseName: row.warehouseName,
    onHand: row.quantity,
    available: row.availableQuantity,
    minStock: row.minStock,
    recommendedStock: row.recommendedStock,
    shortBy: row.shortBy,
    status: row.status,
    unitCost: row.unitCost,
    stockValue: row.stockValue,
  }));
}

/* ── Dashboard ───────────────────────────────────────────────────────────── */

export interface WarehouseDashboard {
  productCount: number;
  totalOnHand: number;
  totalReserved: number;
  stockValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  warehouseCount: number;
  lowStock: LowStockRow[];
  recentMovements: MovementRow[];
}

/**
 * There is no single dashboard endpoint, so this composes the KPI row from the
 * reads that do exist: the stock report's warehouse totals, the low-stock list
 * (its length is the count), one product-list row for `meta.total`, and the
 * eight newest ledger entries.
 */
export async function getWarehouseDashboard(): Promise<WarehouseDashboard> {
  const [stock, lowStock, firstPage, movements, warehouses] = await Promise.all([
    getStockReport(),
    getLowStockReport(),
    listWarehouseProducts({ q: "", page: 1 }),
    listMovementsReport({ page: 1 }),
    listWarehouses(),
  ]);

  return {
    productCount: firstPage.meta.total,
    totalOnHand: stock.totals.onHand,
    totalReserved: stock.totals.reserved,
    stockValue: stock.totals.stockValue,
    lowStockCount: lowStock.filter((row) => row.status === "limited").length,
    outOfStockCount: lowStock.filter((row) => row.status === "out_of_stock").length,
    warehouseCount: warehouses.length,
    lowStock: lowStock.slice(0, 6),
    recentMovements: movements.items.slice(0, 8),
  };
}
