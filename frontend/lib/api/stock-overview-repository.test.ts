import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("./backend-client", async () => {
  const actual = await vi.importActual<typeof import("./backend-client")>("./backend-client");
  return { ...actual, backendRequest: vi.fn() };
});
vi.mock("@/lib/auth/staff-session", () => ({ getStaffSession: vi.fn() }));

import { backendRequest } from "./backend-client";
import { getStaffSession } from "@/lib/auth/staff-session";
import { getStockCounts, listStock } from "./stock-overview-repository";

const SESSION = {
  role: "DIRECTOR" as const,
  accessToken: "tok",
  refreshToken: "rt",
  accessTokenExpiresAt: Date.now() + 900_000,
};

function stockRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1",
    sku: "DP-1",
    nameUz: "Nasos",
    availableQuantity: 5,
    minStock: 2,
    stockStatus: "IN_STOCK",
    category: { nameUz: "Nasoslar" },
    ...overrides,
  };
}

describe("stock-overview-repository", () => {
  beforeEach(() => {
    vi.mocked(backendRequest).mockReset();
    vi.mocked(getStaffSession).mockReset();
    vi.mocked(getStaffSession).mockResolvedValue(SESSION);
  });

  describe("getStockCounts", () => {
    it("tallies statuses across a full active-catalog read", async () => {
      vi.mocked(backendRequest).mockResolvedValue({
        data: [
          stockRow({ stockStatus: "IN_STOCK" }),
          stockRow({ stockStatus: "IN_STOCK" }),
          stockRow({ stockStatus: "LOW_STOCK" }),
          stockRow({ stockStatus: "OUT_OF_STOCK" }),
        ],
      });

      const counts = await getStockCounts();

      expect(counts).toEqual({ total: 4, available: 2, limited: 1, outOfStock: 1 });
      expect(backendRequest).toHaveBeenCalledWith("/products", {
        accessToken: "tok",
        query: { isActive: "true", limit: 100 },
      });
    });

    it("returns all zeros for an empty catalog", async () => {
      vi.mocked(backendRequest).mockResolvedValue({ data: [] });

      expect(await getStockCounts()).toEqual({ total: 0, available: 0, limited: 0, outOfStock: 0 });
    });
  });

  describe("listStock", () => {
    it("passes the status filter and stock sort straight through, and maps availableQuantity to stock", async () => {
      vi.mocked(backendRequest).mockResolvedValue({
        data: [stockRow()],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      const page = await listStock({ status: "limited", page: 1 });

      expect(backendRequest).toHaveBeenCalledWith("/products", {
        accessToken: "tok",
        query: { isActive: "true", stockStatus: "LOW_STOCK", sort: "stock", page: 1, limit: 20 },
      });
      expect(page.items).toEqual([
        {
          id: "p1",
          sku: "DP-1",
          name: "Nasos",
          categoryName: "Nasoslar",
          stock: 5,
          minStock: 2,
          status: "available",
        },
      ]);
    });

    it("falls back to an empty categoryName when a row has no category", async () => {
      vi.mocked(backendRequest).mockResolvedValue({
        data: [stockRow({ category: null })],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      const page = await listStock({ page: 1 });

      expect(page.items[0].categoryName).toBe("");
    });
  });
});
