import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("./backend-client", async () => {
  const actual = await vi.importActual<typeof import("./backend-client")>("./backend-client");
  return { ...actual, backendRequest: vi.fn() };
});
vi.mock("@/lib/auth/staff-session", () => ({ getStaffSession: vi.fn() }));

import { backendRequest } from "./backend-client";
import { getStaffSession } from "@/lib/auth/staff-session";
import {
  getCustomerAnalytics,
  getInventorySummary,
  getProductMovement,
  getSalesSeries,
  getSellerScorecards,
} from "./analytics-detail-repository";
import { buildPeriod } from "@/lib/analytics/period";

const SESSION = {
  role: "DIRECTOR" as const,
  accessToken: "tok",
  refreshToken: "rt",
  accessTokenExpiresAt: Date.now() + 900_000,
};

const PERIOD = buildPeriod(7, new Date("2026-08-08T12:00:00.000Z"));

describe("analytics-detail-repository", () => {
  beforeEach(() => {
    vi.mocked(backendRequest).mockReset();
    vi.mocked(getStaffSession).mockReset();
    vi.mocked(getStaffSession).mockResolvedValue(SESSION);
  });

  describe("getSalesSeries", () => {
    it("sends the period boundaries and passes the three-metric series through", async () => {
      const series = {
        revenue: { current: [], previous: [], currentTotal: 0, previousTotal: 0, change: null },
        orders: { current: [], previous: [], currentTotal: 0, previousTotal: 0, change: null },
        average: { current: [], previous: [], currentTotal: 0, previousTotal: 0, change: null },
      };
      vi.mocked(backendRequest).mockResolvedValue(series);

      const result = await getSalesSeries(PERIOD);

      expect(backendRequest).toHaveBeenCalledWith("/analytics/sales-series", {
        accessToken: "tok",
        query: {
          from: PERIOD.from.toISOString(),
          to: PERIOD.to.toISOString(),
          previousFrom: PERIOD.previousFrom.toISOString(),
          previousTo: PERIOD.previousTo.toISOString(),
          days: PERIOD.days,
        },
      });
      expect(result).toEqual(series);
    });
  });

  describe("getInventorySummary", () => {
    it("values unpriced products at zero and sorts urgency by stock, then value", async () => {
      vi.mocked(backendRequest).mockResolvedValue({
        data: [
          { id: "p1", sku: "A", nameUz: "A", availableQuantity: 0, minStock: 2, price: "100", category: { nameUz: "Cat" } },
          { id: "p2", sku: "B", nameUz: "B", availableQuantity: 1, minStock: 2, price: null, category: { nameUz: "Cat" } },
          { id: "p3", sku: "C", nameUz: "C", availableQuantity: 10, minStock: 2, price: "50", category: { nameUz: "Cat" } },
        ],
      });

      const result = await getInventorySummary();

      expect(result.activeProducts).toBe(3);
      expect(result.unpricedProducts).toBe(1);
      expect(result.outOfStock).toEqual([
        { id: "p1", sku: "A", name: "A", categoryName: "Cat", stock: 0, minStock: 2, price: 100, value: 0 },
      ]);
      expect(result.lowStock).toEqual([
        { id: "p2", sku: "B", name: "B", categoryName: "Cat", stock: 1, minStock: 2, price: null, value: 0 },
      ]);
      expect(result.totalValue).toBe(500); // only p3: 50 * 10
    });
  });

  describe("getProductMovement", () => {
    it("sends the limit alongside the period boundaries", async () => {
      const movement = { fastMoving: [], deadStock: [] };
      vi.mocked(backendRequest).mockResolvedValue(movement);

      await getProductMovement(PERIOD, 5);

      expect(backendRequest).toHaveBeenCalledWith(
        "/analytics/product-movement",
        expect.objectContaining({ query: expect.objectContaining({ limit: 5 }) }),
      );
    });
  });

  describe("getSellerScorecards", () => {
    it("passes the ranked scorecards through unchanged", async () => {
      const scorecards = [
        {
          sellerId: "u1",
          name: "Vali",
          revenue: 900,
          completedOrders: 3,
          cancelledOrders: 0,
          totalOrders: 3,
          averageOrderValue: 300,
          cancelledRate: 0,
          inquiries: 2,
          conversionRate: 50,
        },
      ];
      vi.mocked(backendRequest).mockResolvedValue(scorecards);

      expect(await getSellerScorecards(PERIOD)).toEqual(scorecards);
    });
  });

  describe("getCustomerAnalytics", () => {
    it("sends the limit alongside the period boundaries", async () => {
      const analytics = { newCustomers: 1, returningCustomers: 2, topCustomers: [] };
      vi.mocked(backendRequest).mockResolvedValue(analytics);

      const result = await getCustomerAnalytics(PERIOD, 5);

      expect(backendRequest).toHaveBeenCalledWith(
        "/analytics/customer-analytics",
        expect.objectContaining({ query: expect.objectContaining({ limit: 5 }) }),
      );
      expect(result).toEqual(analytics);
    });
  });
});
