import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("./backend-client", async () => {
  const actual = await vi.importActual<typeof import("./backend-client")>("./backend-client");
  return { ...actual, backendRequest: vi.fn() };
});
vi.mock("@/lib/auth/staff-session", () => ({ getStaffSession: vi.fn() }));

import { BackendApiError, backendRequest } from "./backend-client";
import { getStaffSession } from "@/lib/auth/staff-session";
import { decideDiscount, listAudit, listAuditEntityTypes, listPendingDiscounts } from "./discount-repository";

const SESSION = {
  role: "DIRECTOR" as const,
  accessToken: "tok",
  refreshToken: "rt",
  accessTokenExpiresAt: Date.now() + 900_000,
};

describe("discount-repository", () => {
  beforeEach(() => {
    vi.mocked(backendRequest).mockReset();
    vi.mocked(getStaffSession).mockReset();
    vi.mocked(getStaffSession).mockResolvedValue(SESSION);
  });

  describe("listPendingDiscounts", () => {
    it("reads backend/'s pending queue and turns createdAt back into a Date", async () => {
      vi.mocked(backendRequest).mockResolvedValue([
        {
          id: "dr1",
          orderId: "o1",
          orderNumber: "ORD-1",
          sellerName: "Vali",
          sellerLimit: 5,
          customerName: "Aziz",
          requestedPercent: 12,
          reason: "Doimiy mijoz",
          subtotal: 1000,
          totalIfApproved: 880,
          createdAt: "2026-08-01T00:00:00.000Z",
        },
      ]);

      const result = await listPendingDiscounts();

      expect(backendRequest).toHaveBeenCalledWith("/discount-requests", { accessToken: "tok" });
      expect(result).toHaveLength(1);
      expect(result[0].createdAt).toBeInstanceOf(Date);
      expect(result[0].createdAt.toISOString()).toBe("2026-08-01T00:00:00.000Z");
      expect(result[0]).toMatchObject({ id: "dr1", sellerLimit: 5, totalIfApproved: 880 });
    });
  });

  describe("decideDiscount", () => {
    it("PATCHes backend/'s decision endpoint and reports ok", async () => {
      vi.mocked(backendRequest).mockResolvedValue({ id: "dr1" });

      const result = await decideDiscount("dr1", true, "director-1", "yaxshi");

      expect(backendRequest).toHaveBeenCalledWith("/discount-requests/dr1/decision", {
        method: "PATCH",
        accessToken: "tok",
        body: { approve: true, note: "yaxshi" },
      });
      expect(result).toEqual({ ok: true });
    });

    it("maps a 404 to not_found", async () => {
      vi.mocked(backendRequest).mockRejectedValue(new BackendApiError("Not found", 404, "not_found"));

      const result = await decideDiscount("missing", true, "director-1", null);

      expect(result).toEqual({ ok: false, reason: "not_found" });
    });

    it("maps a 409 to already_decided", async () => {
      vi.mocked(backendRequest).mockRejectedValue(new BackendApiError("Conflict", 409, "conflict"));

      const result = await decideDiscount("dr1", false, "director-1", null);

      expect(result).toEqual({ ok: false, reason: "already_decided" });
    });

    it("rethrows any other backend failure", async () => {
      vi.mocked(backendRequest).mockRejectedValue(new BackendApiError("Down", 503, "unavailable"));

      await expect(decideDiscount("dr1", true, "director-1", null)).rejects.toThrow("Down");
    });
  });

  describe("listAudit", () => {
    it("maps backend/'s page shape onto AuditPage with Date rows", async () => {
      vi.mocked(backendRequest).mockResolvedValue({
        data: [
          {
            id: "log1",
            action: "UPDATE",
            entityType: "Product",
            entityId: "p1",
            actorName: "Vali",
            before: { price: 10 },
            after: { price: 20 },
            createdAt: "2026-08-01T00:00:00.000Z",
          },
        ],
        meta: { page: 1, limit: 30, total: 1, totalPages: 1 },
      });

      const result = await listAudit(1, "Product");

      expect(backendRequest).toHaveBeenCalledWith("/audit", {
        accessToken: "tok",
        query: { page: 1, entityType: "Product" },
      });
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(result.total).toBe(1);
      expect(result.items[0].createdAt).toBeInstanceOf(Date);
    });
  });

  describe("listAuditEntityTypes", () => {
    it("passes through backend/'s distinct entity-type list", async () => {
      vi.mocked(backendRequest).mockResolvedValue(["DiscountRequest", "Product"]);

      const result = await listAuditEntityTypes();

      expect(backendRequest).toHaveBeenCalledWith("/audit/entity-types", { accessToken: "tok" });
      expect(result).toEqual(["DiscountRequest", "Product"]);
    });
  });
});
