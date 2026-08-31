import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("./backend-client", async () => {
  const actual = await vi.importActual<typeof import("./backend-client")>("./backend-client");
  return { ...actual, backendRequest: vi.fn() };
});
vi.mock("@/lib/auth/staff-session", () => ({ getStaffSession: vi.fn() }));

import { backendRequest } from "./backend-client";
import { getStaffSession } from "@/lib/auth/staff-session";
import {
  getDashboardCounts,
  getLowStockProducts,
  getOrderStatusBreakdown,
  getRecentOrders,
  getRevenueSeries,
  getSalesSummary,
  getSellerPerformance,
} from "./analytics-repository";
import { buildPeriod } from "@/lib/analytics/period";

const SESSION = {
  role: "DIRECTOR" as const,
  accessToken: "tok",
  refreshToken: "rt",
  accessTokenExpiresAt: Date.now() + 900_000,
};

const PERIOD = buildPeriod(7, new Date("2026-08-08T12:00:00.000Z"));

describe("analytics-repository", () => {
  beforeEach(() => {
    vi.mocked(backendRequest).mockReset();
    vi.mocked(getStaffSession).mockReset();
    vi.mocked(getStaffSession).mockResolvedValue(SESSION);
  });

  describe("getSalesSummary", () => {
    it("sends the period as ISO boundaries and passes the response through", async () => {
      const summary = {
        current: { revenue: 100, orders: 2 },
        previous: { revenue: 50, orders: 1 },
        revenueChange: 100,
        ordersChange: 100,
        averageOrderValue: 50,
        pipelineValue: 30,
      };
      vi.mocked(backendRequest).mockResolvedValue(summary);

      const result = await getSalesSummary(PERIOD);

      expect(backendRequest).toHaveBeenCalledWith("/analytics/sales-summary", {
        accessToken: "tok",
        query: {
          from: PERIOD.from.toISOString(),
          to: PERIOD.to.toISOString(),
          previousFrom: PERIOD.previousFrom.toISOString(),
          previousTo: PERIOD.previousTo.toISOString(),
          days: PERIOD.days,
        },
      });
      expect(result).toEqual(summary);
    });
  });

  describe("getRevenueSeries", () => {
    it("passes the day-point series through unchanged", async () => {
      const series = { current: [{ day: "2026-08-01", value: 10 }], previous: [{ day: "2026-08-01", value: 5 }] };
      vi.mocked(backendRequest).mockResolvedValue(series);

      expect(await getRevenueSeries(PERIOD)).toEqual(series);
    });
  });

  describe("getSellerPerformance", () => {
    it("passes the ranked list through unchanged", async () => {
      const rows = [{ sellerId: "u1", name: "Vali", revenue: 900, orders: 3 }];
      vi.mocked(backendRequest).mockResolvedValue(rows);

      expect(await getSellerPerformance(PERIOD)).toEqual(rows);
    });
  });

  describe("getLowStockProducts", () => {
    it("filters to limited/out_of_stock, sorts by stock ascending, and caps at the limit", async () => {
      vi.mocked(backendRequest).mockResolvedValue({
        data: [
          { id: "p1", sku: "A", nameUz: "A", availableQuantity: 5, minStock: 2, stockStatus: "limited" },
          { id: "p2", sku: "B", nameUz: "B", availableQuantity: 0, minStock: 2, stockStatus: "out_of_stock" },
          { id: "p3", sku: "C", nameUz: "C", availableQuantity: 50, minStock: 2, stockStatus: "available" },
        ],
      });

      const result = await getLowStockProducts(1);

      expect(backendRequest).toHaveBeenCalledWith("/products", {
        accessToken: "tok",
        query: { isActive: "true", limit: 100 },
      });
      expect(result).toEqual([{ id: "p2", sku: "B", name: "B", stock: 0, minStock: 2 }]);
    });
  });

  describe("getOrderStatusBreakdown", () => {
    it("passes the three-bucket count through unchanged", async () => {
      const breakdown = { completed: 5, open: 3, cancelled: 1 };
      vi.mocked(backendRequest).mockResolvedValue(breakdown);

      expect(await getOrderStatusBreakdown(PERIOD)).toEqual(breakdown);
    });
  });

  describe("getRecentOrders", () => {
    it("folds backend/'s NEW/PREPARING statuses back onto root's own vocabulary", async () => {
      vi.mocked(backendRequest).mockResolvedValue([
        {
          id: "o1",
          orderNumber: "ORD-1",
          customerName: "Aziz",
          sellerName: "Vali",
          status: "NEW",
          total: 1000,
          createdAt: "2026-08-01T00:00:00.000Z",
        },
        {
          id: "o2",
          orderNumber: "ORD-2",
          customerName: "Bek",
          sellerName: "Vali",
          status: "PREPARING",
          total: 2000,
          createdAt: "2026-08-02T00:00:00.000Z",
        },
      ]);

      const result = await getRecentOrders(6);

      expect(result[0].status).toBe("PENDING");
      expect(result[1].status).toBe("CONFIRMED");
      expect(result[0].createdAt).toBeInstanceOf(Date);
    });
  });

  describe("getDashboardCounts", () => {
    it("passes the counts through unchanged", async () => {
      const counts = { newInquiries: 2, pendingDiscounts: 1, activeSellers: 4 };
      vi.mocked(backendRequest).mockResolvedValue(counts);

      expect(await getDashboardCounts()).toEqual(counts);
    });
  });
});
