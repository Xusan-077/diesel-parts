import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("./backend-client", async () => {
  const actual = await vi.importActual<typeof import("./backend-client")>("./backend-client");
  return { ...actual, backendRequest: vi.fn() };
});
vi.mock("@/lib/auth/staff-session", () => ({ getStaffSession: vi.fn() }));

import { backendRequest } from "./backend-client";
import { getStaffSession } from "@/lib/auth/staff-session";
import {
  getWarehouseDashboard,
  getWarehouseProduct,
  listGoodsReceipts,
  listWarehouseProducts,
} from "./warehouse-repository";

const request = vi.mocked(backendRequest);

beforeEach(() => {
  request.mockReset();
  vi.mocked(getStaffSession).mockResolvedValue({
    role: "DIRECTOR",
    accessToken: "tok",
    refreshToken: "rt",
    accessTokenExpiresAt: Date.now() + 900_000,
  });
});

function backendProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: "p-1",
    sku: "DP-INJ-1",
    barcode: "4600000000001",
    nameUz: "Forsunka",
    unit: "dona",
    minStock: 5,
    oemNumbers: ["0445120231"],
    quantity: 20,
    reservedQuantity: 4,
    availableQuantity: 16,
    stockStatus: "available",
    stockValue: 1_600_000,
    averageCost: 100_000,
    lastPurchaseCost: 95_000,
    purchasePrice: 90_000,
    category: { id: "c-1", nameUz: "Yoqilg'i tizimi" },
    brand: { id: "b-1", name: "Bosch" },
    ...overrides,
  };
}

describe("listWarehouseProducts", () => {
  it("flattens the backend row and picks the most specific unit cost", async () => {
    request.mockResolvedValue({
      data: [backendProduct(), backendProduct({ id: "p-2", averageCost: null, lastPurchaseCost: null })],
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
      scope: "all",
    });

    const page = await listWarehouseProducts({ q: "", page: 1 });

    expect(page.meta).toEqual({ page: 1, pageSize: 20, total: 2, totalPages: 1 });
    expect(page.items[0]).toMatchObject({
      name: "Forsunka",
      categoryName: "Yoqilg'i tizimi",
      brandName: "Bosch",
      onHand: 20,
      reserved: 4,
      available: 16,
      unitCost: 100_000,
    });
    // averageCost and lastPurchaseCost both null → falls back to list price
    expect(page.items[1].unitCost).toBe(90_000);
  });

  it("drops an empty search term from the query", async () => {
    request.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 }, scope: "all" });

    await listWarehouseProducts({ q: "", page: 2, status: "limited" });

    expect(request).toHaveBeenCalledWith("/warehouse/products", {
      accessToken: "tok",
      query: { q: undefined, status: "limited", warehouseId: undefined, page: 2, limit: 20 },
    });
  });
});

describe("getWarehouseProduct", () => {
  it("maps the per-warehouse breakdown", async () => {
    request.mockResolvedValue({
      ...backendProduct(),
      byWarehouse: [
        {
          warehouseId: "w-1",
          warehouseCode: "W1",
          warehouseName: "Markaziy",
          quantity: 12,
          reservedQuantity: 2,
          availableQuantity: 10,
          averageCost: 100_000,
        },
      ],
    });

    const detail = await getWarehouseProduct("p-1");

    expect(detail.byWarehouse).toEqual([
      {
        warehouseId: "w-1",
        warehouseCode: "W1",
        warehouseName: "Markaziy",
        onHand: 12,
        reserved: 2,
        available: 10,
        unitCost: 100_000,
      },
    ]);
  });
});

describe("listGoodsReceipts", () => {
  it("sums the line count and coerces the decimal strings", async () => {
    request.mockResolvedValue({
      data: [
        {
          id: "gr-1",
          receiptNumber: "GR-2026-0001",
          warehouseId: "w-1",
          supplierName: "Diesel Impex",
          note: null,
          status: "DRAFT",
          subtotal: "1000000.00",
          discount: "50000.00",
          tax: "0.00",
          total: "950000.00",
          createdAt: "2026-09-01T10:00:00.000Z",
          approvedAt: null,
          warehouse: { id: "w-1", name: "Markaziy", code: "W1" },
          createdBy: { id: "u-1", name: "Direktor" },
          approvedBy: null,
          items: [
            { id: "i-1", productId: "p-1", quantity: 10, unitCost: "100000", lineTotal: "1000000", product: { id: "p-1", sku: "DP-1", nameUz: "Forsunka", unit: "dona" } },
          ],
        },
      ],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    const page = await listGoodsReceipts({ q: "", page: 1 });

    expect(page.items[0]).toMatchObject({
      receiptNumber: "GR-2026-0001",
      warehouseCode: "W1",
      supplierName: "Diesel Impex",
      subtotal: 1_000_000,
      discount: 50_000,
      total: 950_000,
      itemCount: 1,
    });
  });
});

describe("getWarehouseDashboard", () => {
  it("composes the KPI row from the reads that exist", async () => {
    request.mockImplementation((path: string) => {
      if (path === "/warehouse/reports/stock") {
        return Promise.resolve({
          data: [],
          totals: { skuCount: 3, quantity: 120, reservedQuantity: 8, stockValue: 9_000_000 },
        });
      }
      if (path === "/warehouse/reports/low-stock") {
        return Promise.resolve({
          data: [
            { productId: "p-1", sku: "A", name: "A", unit: "dona", warehouseCode: "W1", warehouseName: "M", quantity: 2, availableQuantity: 2, minStock: 5, recommendedStock: 10, shortBy: 8, status: "limited", unitCost: 1, stockValue: 2 },
            { productId: "p-2", sku: "B", name: "B", unit: "dona", warehouseCode: "W1", warehouseName: "M", quantity: 0, availableQuantity: 0, minStock: 5, recommendedStock: 10, shortBy: 10, status: "out_of_stock", unitCost: 1, stockValue: 0 },
          ],
        });
      }
      if (path === "/warehouse/products") {
        return Promise.resolve({ data: [], meta: { page: 1, limit: 20, total: 42, totalPages: 3 }, scope: "all" });
      }
      if (path === "/warehouse/reports/movements") {
        return Promise.resolve({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } });
      }
      if (path === "/warehouses") {
        return Promise.resolve([{ id: "w-1", name: "M", code: "W1", location: null, address: null, status: "ACTIVE", managerId: null, manager: null, createdAt: "", updatedAt: "" }]);
      }
      throw new Error(`unexpected path ${path}`);
    });

    const dashboard = await getWarehouseDashboard();

    expect(dashboard).toMatchObject({
      productCount: 42,
      totalOnHand: 120,
      totalReserved: 8,
      stockValue: 9_000_000,
      lowStockCount: 1,
      outOfStockCount: 1,
      warehouseCount: 1,
    });
    expect(dashboard.lowStock).toHaveLength(2);
  });
});
