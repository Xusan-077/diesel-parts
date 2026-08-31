import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("./backend-client", async () => {
  const actual = await vi.importActual<typeof import("./backend-client")>("./backend-client");
  return { ...actual, backendRequest: vi.fn() };
});
vi.mock("@/lib/auth/staff-session", () => ({ getStaffSession: vi.fn() }));

import { BackendApiError, backendRequest } from "./backend-client";
import { getStaffSession } from "@/lib/auth/staff-session";
import {
  createOrder,
  getOrder,
  listOrders,
  requestOrderDiscount,
  updateOrder,
} from "./order-repository";
import type { ScopeActor } from "./seller-scope";
import type { DiscountActor } from "./order-repository";

const SESSION = {
  role: "DIRECTOR" as const,
  accessToken: "tok",
  refreshToken: "rt",
  accessTokenExpiresAt: Date.now() + 900_000,
};

const actor: ScopeActor = { id: "seller-1", role: "SELLER" };
const discountActor: DiscountActor = { id: "seller-1", role: "SELLER", discountLimit: 5 };

function backendOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "ord-1",
    orderNumber: "DP-1002",
    customerId: "cus-1",
    sellerId: "seller-1",
    status: "NEW",
    currency: "UZS",
    subtotal: "200.00",
    discountRequestedPercent: "0",
    discountApprovedPercent: "10",
    total: "180.00",
    notes: "call back",
    inquiryId: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-02T00:00:00.000Z",
    customer: { id: "cus-1", name: "Aziz", phone: "998901234567" },
    seller: { id: "seller-1", user: { id: "u-1", name: "Vali", phone: "998900000000" } },
    items: [
      {
        id: "li-1",
        productId: "prod-1",
        productSku: "SKU-1",
        productName: "Fuel Filter",
        quantity: 2,
        price: "100.00",
        total: "200.00",
      },
    ],
    ...overrides,
  };
}

describe("order-repository", () => {
  beforeEach(() => {
    vi.mocked(backendRequest).mockReset();
    vi.mocked(getStaffSession).mockReset();
    vi.mocked(getStaffSession).mockResolvedValue(SESSION);
  });

  describe("listOrders", () => {
    it("sends the query, translates status, and maps a page", async () => {
      vi.mocked(backendRequest).mockResolvedValue({
        data: [
          backendOrder(),
          backendOrder({ id: "ord-2", status: "PREPARING", items: [] }),
        ],
        meta: { page: 2, limit: 20, total: 41, totalPages: 3 },
      });

      const page = await listOrders(actor, {
        status: "PENDING",
        customerId: "cus-1",
        page: 2,
      });

      expect(backendRequest).toHaveBeenCalledWith("/seller/orders", {
        accessToken: "tok",
        query: { status: "NEW", customerId: "cus-1", page: 2 },
      });
      expect(page.items[0].status).toBe("PENDING");
      expect(page.items[1].status).toBe("CONFIRMED");
      expect(page.items[0].subtotal).toBe(200);
      expect(page.items[0].totalAmount).toBe(180);
      expect(page.items[0].discountApprovedPercent).toBe(10);
      expect(page.items[0].itemCount).toBe(1);
      expect(page.items[1].itemCount).toBe(0);
      expect(page.items[0].sellerName).toBe("Vali");
      expect(page.items[0].createdAt).toBeInstanceOf(Date);
      expect(page).toMatchObject({ total: 41, page: 2, pageSize: 20, totalPages: 3 });
    });

    it("omits an absent status filter", async () => {
      vi.mocked(backendRequest).mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 1 },
      });

      await listOrders(actor, { page: 1 });

      expect(backendRequest).toHaveBeenCalledWith("/seller/orders", {
        accessToken: "tok",
        query: { status: undefined, customerId: undefined, page: 1 },
      });
    });
  });

  describe("getOrder", () => {
    it("maps items and discount requests", async () => {
      vi.mocked(backendRequest).mockResolvedValue(
        backendOrder({
          discountRequests: [
            {
              id: "dr-1",
              requestedPercent: "20",
              reason: "loyal",
              status: "PENDING",
              decisionNote: null,
              createdAt: "2026-08-03T00:00:00.000Z",
              reviewedAt: null,
            },
          ],
        }),
      );

      const detail = await getOrder("ord-1", actor);

      expect(backendRequest).toHaveBeenCalledWith("/seller/orders/ord-1", {
        accessToken: "tok",
      });
      expect(detail?.items[0]).toEqual({
        id: "li-1",
        productId: "prod-1",
        productSku: "SKU-1",
        productName: "Fuel Filter",
        qty: 2,
        unitPrice: 100,
        lineTotal: 200,
      });
      expect(detail?.discountRequests[0]).toEqual({
        id: "dr-1",
        requestedPercent: 20,
        reason: "loyal",
        status: "PENDING",
        decisionNote: null,
        createdAt: new Date("2026-08-03T00:00:00.000Z"),
        reviewedAt: null,
      });
    });

    it("returns null on a 404", async () => {
      vi.mocked(backendRequest).mockRejectedValue(new BackendApiError("gone", 404, "not_found"));
      expect(await getOrder("missing", actor)).toBeNull();
    });

    it("returns null on a 403", async () => {
      vi.mocked(backendRequest).mockRejectedValue(new BackendApiError("nope", 403, "forbidden"));
      expect(await getOrder("other", actor)).toBeNull();
    });

    it("rethrows any other failure", async () => {
      vi.mocked(backendRequest).mockRejectedValue(new BackendApiError("down", 503, "unavailable"));
      await expect(getOrder("ord-1", actor)).rejects.toThrow("down");
    });
  });

  describe("createOrder", () => {
    it("translates qty to quantity and returns the new id", async () => {
      vi.mocked(backendRequest).mockResolvedValue({ id: "ord-1" });

      const result = await createOrder(
        {
          customerId: "cus-1",
          items: [{ productId: "prod-1", qty: 3, unitPrice: 50 }],
          notes: "urgent",
          inquiryId: "inq-1",
        },
        actor,
      );

      expect(backendRequest).toHaveBeenCalledWith("/seller/orders", {
        method: "POST",
        accessToken: "tok",
        body: {
          customerId: "cus-1",
          items: [{ productId: "prod-1", quantity: 3, price: 50 }],
          notes: "urgent",
          inquiryId: "inq-1",
        },
      });
      expect(result).toEqual({ ok: true, id: "ord-1" });
    });

    it("maps a structured insufficient_stock body to the full variant", async () => {
      vi.mocked(backendRequest).mockRejectedValue(
        new BackendApiError("no stock", 409, "insufficient_stock", {
          error: "insufficient_stock",
          productId: "prod-1",
          productName: "Fuel Filter",
          requested: 5,
          available: 1,
        }),
      );

      const result = await createOrder(
        { customerId: "cus-1", items: [{ productId: "prod-1", qty: 5 }] },
        actor,
      );

      expect(result).toEqual({
        ok: false,
        reason: "insufficient_stock",
        productId: "prod-1",
        productName: "Fuel Filter",
        requested: 5,
        available: 1,
      });
    });

    it("maps customer_not_found", async () => {
      vi.mocked(backendRequest).mockRejectedValue(
        new BackendApiError("no customer", 404, "customer_not_found", {
          error: "customer_not_found",
        }),
      );

      expect(
        await createOrder(
          { customerId: "cus-x", items: [{ productId: "prod-1", qty: 1 }] },
          actor,
        ),
      ).toEqual({ ok: false, reason: "customer_not_found" });
    });

    it("maps price_required with the product id", async () => {
      vi.mocked(backendRequest).mockRejectedValue(
        new BackendApiError("price", 400, "price_required", {
          error: "price_required",
          productId: "prod-9",
        }),
      );

      expect(
        await createOrder(
          { customerId: "cus-1", items: [{ productId: "prod-9", qty: 1 }] },
          actor,
        ),
      ).toEqual({ ok: false, reason: "price_required", productId: "prod-9" });
    });

    it("maps number_conflict", async () => {
      vi.mocked(backendRequest).mockRejectedValue(
        new BackendApiError("busy", 409, "number_conflict", { error: "number_conflict" }),
      );

      expect(
        await createOrder(
          { customerId: "cus-1", items: [{ productId: "prod-1", qty: 1 }] },
          actor,
        ),
      ).toEqual({ ok: false, reason: "number_conflict" });
    });

    it("rethrows an unmapped failure", async () => {
      vi.mocked(backendRequest).mockRejectedValue(new BackendApiError("boom", 500, "500"));

      await expect(
        createOrder(
          { customerId: "cus-1", items: [{ productId: "prod-1", qty: 1 }] },
          actor,
        ),
      ).rejects.toThrow("boom");
    });
  });

  describe("updateOrder", () => {
    it("translates status to the backend name on the wire", async () => {
      vi.mocked(backendRequest).mockResolvedValue({ id: "ord-1" });

      const result = await updateOrder("ord-1", { status: "PENDING" }, actor);

      expect(backendRequest).toHaveBeenCalledWith("/seller/orders/ord-1", {
        method: "PATCH",
        accessToken: "tok",
        body: { status: "NEW", items: undefined, notes: undefined },
      });
      expect(result).toEqual({ ok: true, id: "ord-1" });
    });

    it("maps a 404 to not_found", async () => {
      vi.mocked(backendRequest).mockRejectedValue(new BackendApiError("gone", 404, "not_found"));

      expect(await updateOrder("missing", { notes: "x" }, actor)).toEqual({
        ok: false,
        reason: "not_found",
      });
    });

    it("maps locked", async () => {
      vi.mocked(backendRequest).mockRejectedValue(
        new BackendApiError("locked", 409, "locked", { error: "locked" }),
      );

      expect(
        await updateOrder(
          "ord-1",
          { items: [{ productId: "prod-1", qty: 1 }] },
          actor,
        ),
      ).toEqual({ ok: false, reason: "locked" });
    });

    it("maps illegal_transition and translates from/to back to the root enum", async () => {
      vi.mocked(backendRequest).mockRejectedValue(
        new BackendApiError("nope", 409, "illegal_transition", {
          error: "illegal_transition",
          from: "NEW",
          to: "PREPARING",
        }),
      );

      expect(
        await updateOrder("ord-1", { status: "CONFIRMED" }, actor),
      ).toEqual({
        ok: false,
        reason: "illegal_transition",
        from: "PENDING",
        to: "CONFIRMED",
      });
    });

    it("maps a structured insufficient_stock body on a re-line", async () => {
      vi.mocked(backendRequest).mockRejectedValue(
        new BackendApiError("no stock", 409, "insufficient_stock", {
          error: "insufficient_stock",
          productId: "prod-1",
          productName: "Fuel Filter",
          requested: 9,
          available: 2,
        }),
      );

      expect(
        await updateOrder(
          "ord-1",
          { items: [{ productId: "prod-1", qty: 9 }] },
          actor,
        ),
      ).toEqual({
        ok: false,
        reason: "insufficient_stock",
        productId: "prod-1",
        productName: "Fuel Filter",
        requested: 9,
        available: 2,
      });
    });
  });

  describe("requestOrderDiscount", () => {
    it("maps an immediate approval", async () => {
      vi.mocked(backendRequest).mockResolvedValue({ kind: "immediate", totalAmount: 950 });

      const result = await requestOrderDiscount("ord-1", { percent: 5 }, discountActor);

      expect(backendRequest).toHaveBeenCalledWith("/seller/orders/ord-1/discount-request", {
        method: "POST",
        accessToken: "tok",
        body: { percent: 5, reason: undefined },
      });
      expect(result).toEqual({ ok: true, kind: "immediate", totalAmount: 950 });
    });

    it("maps a queued request", async () => {
      vi.mocked(backendRequest).mockResolvedValue({
        kind: "needs_approval",
        requestId: "dr-1",
      });

      const result = await requestOrderDiscount(
        "ord-1",
        { percent: 20, reason: "loyal" },
        discountActor,
      );

      expect(result).toEqual({ ok: true, kind: "needs_approval", requestId: "dr-1" });
    });

    it("maps a 404 to not_found", async () => {
      vi.mocked(backendRequest).mockRejectedValue(new BackendApiError("gone", 404, "not_found"));

      expect(
        await requestOrderDiscount("missing", { percent: 5 }, discountActor),
      ).toEqual({ ok: false, reason: "not_found" });
    });

    it("maps a 409 pending_exists", async () => {
      vi.mocked(backendRequest).mockRejectedValue(
        new BackendApiError("pending", 409, "pending_exists", { error: "pending_exists" }),
      );

      expect(
        await requestOrderDiscount("ord-1", { percent: 20 }, discountActor),
      ).toEqual({ ok: false, reason: "pending_exists" });
    });

    it("maps a 409 locked", async () => {
      vi.mocked(backendRequest).mockRejectedValue(
        new BackendApiError("locked", 409, "locked", { error: "locked" }),
      );

      expect(
        await requestOrderDiscount("ord-1", { percent: 5 }, discountActor),
      ).toEqual({ ok: false, reason: "locked" });
    });

    it("rethrows an unmapped conflict", async () => {
      vi.mocked(backendRequest).mockRejectedValue(
        new BackendApiError("weird", 409, "something_else", { error: "something_else" }),
      );

      await expect(
        requestOrderDiscount("ord-1", { percent: 5 }, discountActor),
      ).rejects.toThrow("weird");
    });
  });
});
