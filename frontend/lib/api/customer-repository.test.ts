import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("./backend-client", async () => {
  const actual = await vi.importActual<typeof import("./backend-client")>("./backend-client");
  return { ...actual, backendRequest: vi.fn() };
});
vi.mock("@/lib/auth/staff-session", () => ({ getStaffSession: vi.fn() }));

import { BackendApiError, backendRequest } from "./backend-client";
import { getStaffSession } from "@/lib/auth/staff-session";
import {
  claimCustomer,
  createCustomer,
  findCustomersByPhone,
  getCustomer,
  listCustomerInquiries,
  listCustomers,
  updateCustomer,
} from "./customer-repository";
import type { ScopeActor } from "./seller-scope";

const SESSION = {
  role: "DIRECTOR" as const,
  accessToken: "tok",
  refreshToken: "rt",
  accessTokenExpiresAt: Date.now() + 900_000,
};

const actor: ScopeActor = { id: "seller-1", role: "SELLER" };

describe("customer-repository", () => {
  beforeEach(() => {
    vi.mocked(backendRequest).mockReset();
    vi.mocked(getStaffSession).mockReset();
    vi.mocked(getStaffSession).mockResolvedValue(SESSION);
  });

  describe("listCustomers", () => {
    it("passes search/page/pool through as query params and maps dates back", async () => {
      vi.mocked(backendRequest).mockResolvedValue({
        data: [
          {
            id: "cus-1",
            name: "Aziz",
            phone: "998901234567",
            email: null,
            company: null,
            notes: null,
            assignedSellerId: "seller-1",
            assignedSellerName: "Vali",
            orderCount: 2,
            totalSpent: 1500,
            createdAt: "2026-08-01T00:00:00.000Z",
            updatedAt: "2026-08-02T00:00:00.000Z",
          },
        ],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      const result = await listCustomers(actor, {
        search: "Aziz",
        page: 2,
        pool: true,
      });

      expect(backendRequest).toHaveBeenCalledWith("/seller/customers", {
        accessToken: "tok",
        query: { search: "Aziz", page: 2, pool: "true" },
      });
      expect(result.total).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.items[0].createdAt).toBeInstanceOf(Date);
      expect(result.items[0].updatedAt).toBeInstanceOf(Date);
      expect(result.items[0].createdAt.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    });

    it("sends pool=false when the query did not ask for the pool", async () => {
      vi.mocked(backendRequest).mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 1 },
      });

      await listCustomers(actor, { page: 1, pool: false });

      expect(backendRequest).toHaveBeenCalledWith("/seller/customers", {
        accessToken: "tok",
        query: { search: undefined, page: 1, pool: "false" },
      });
    });
  });

  describe("getCustomer", () => {
    it("returns the mapped row", async () => {
      vi.mocked(backendRequest).mockResolvedValue({
        id: "cus-1",
        name: "Aziz",
        phone: "998901234567",
        email: null,
        company: null,
        notes: null,
        assignedSellerId: null,
        assignedSellerName: null,
        orderCount: 0,
        totalSpent: 0,
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-01T00:00:00.000Z",
      });

      const result = await getCustomer("cus-1", actor);

      expect(backendRequest).toHaveBeenCalledWith("/seller/customers/cus-1", {
        accessToken: "tok",
      });
      expect(result?.createdAt).toBeInstanceOf(Date);
    });

    it("returns null on a 404", async () => {
      vi.mocked(backendRequest).mockRejectedValue(new BackendApiError("Not found", 404, "not_found"));

      const result = await getCustomer("missing", actor);

      expect(result).toBeNull();
    });

    it("rethrows any other backend failure", async () => {
      vi.mocked(backendRequest).mockRejectedValue(new BackendApiError("Down", 503, "unavailable"));

      await expect(getCustomer("cus-1", actor)).rejects.toThrow("Down");
    });
  });

  describe("createCustomer", () => {
    it("POSTs the input and returns the new id", async () => {
      vi.mocked(backendRequest).mockResolvedValue({ id: "cus-1" });

      const result = await createCustomer({ name: "Aziz", phone: "998901234567" }, actor);

      expect(backendRequest).toHaveBeenCalledWith("/seller/customers", {
        method: "POST",
        accessToken: "tok",
        body: { name: "Aziz", phone: "998901234567" },
      });
      expect(result).toEqual({ ok: true, id: "cus-1" });
    });
  });

  describe("updateCustomer", () => {
    it("PATCHes the input and reports ok", async () => {
      vi.mocked(backendRequest).mockResolvedValue({ id: "cus-1" });

      const result = await updateCustomer("cus-1", { name: "Aziz Karimov" }, actor);

      expect(backendRequest).toHaveBeenCalledWith("/seller/customers/cus-1", {
        method: "PATCH",
        accessToken: "tok",
        body: { name: "Aziz Karimov" },
      });
      expect(result).toEqual({ ok: true, id: "cus-1" });
    });

    it("maps a 404 to not_found", async () => {
      vi.mocked(backendRequest).mockRejectedValue(new BackendApiError("Not found", 404, "not_found"));

      const result = await updateCustomer("missing", { name: "Aziz" }, actor);

      expect(result).toEqual({ ok: false, reason: "not_found" });
    });

    it("rethrows any other backend failure", async () => {
      vi.mocked(backendRequest).mockRejectedValue(new BackendApiError("Down", 503, "unavailable"));

      await expect(updateCustomer("cus-1", { name: "Aziz" }, actor)).rejects.toThrow("Down");
    });
  });

  describe("claimCustomer", () => {
    it("claims and reports ok", async () => {
      vi.mocked(backendRequest).mockResolvedValue({ id: "cus-1" });

      const result = await claimCustomer("cus-1", actor);

      expect(backendRequest).toHaveBeenCalledWith("/seller/customers/cus-1/claim", {
        method: "POST",
        accessToken: "tok",
      });
      expect(result).toEqual({ ok: true, id: "cus-1" });
    });

    it("maps a 404 to not_found", async () => {
      vi.mocked(backendRequest).mockRejectedValue(new BackendApiError("Not found", 404, "not_found"));

      const result = await claimCustomer("missing", actor);

      expect(result).toEqual({ ok: false, reason: "not_found" });
    });

    it("maps a 409 to taken", async () => {
      vi.mocked(backendRequest).mockRejectedValue(new BackendApiError("Conflict", 409, "conflict"));

      const result = await claimCustomer("cus-1", actor);

      expect(result).toEqual({ ok: false, reason: "taken" });
    });

    it("rethrows any other backend failure", async () => {
      vi.mocked(backendRequest).mockRejectedValue(new BackendApiError("Down", 503, "unavailable"));

      await expect(claimCustomer("cus-1", actor)).rejects.toThrow("Down");
    });
  });

  describe("findCustomersByPhone", () => {
    it("rebuilds the Map from backend's array response", async () => {
      vi.mocked(backendRequest).mockResolvedValue([
        { phone: "901234567", id: "cus-1", name: "Aziz" },
        { phone: "907654321", id: "cus-2", name: "Vali" },
      ]);

      const result = await findCustomersByPhone(["998901234567", "998907654321"], actor);

      expect(backendRequest).toHaveBeenCalledWith("/seller/customers/by-phone", {
        accessToken: "tok",
        query: { phones: "998901234567,998907654321" },
      });
      expect(result).toEqual(
        new Map([
          ["901234567", { id: "cus-1", name: "Aziz" }],
          ["907654321", { id: "cus-2", name: "Vali" }],
        ]),
      );
    });

    it("short-circuits on an empty input array without calling backend", async () => {
      const result = await findCustomersByPhone([], actor);

      expect(result).toEqual(new Map());
      expect(backendRequest).not.toHaveBeenCalled();
    });
  });

  describe("listCustomerInquiries", () => {
    it("picks only the documented fields out of a wider backend response", async () => {
      vi.mocked(backendRequest).mockResolvedValue([
        {
          id: "inq-1",
          customerName: "Ali",
          phone: "998901234567",
          email: "ali@example.com",
          message: "Need a filter",
          productId: "p1",
          productSku: "SKU-1",
          quantity: 2,
          status: "NEW",
          source: "CONTACT_FORM",
          column: "new",
          assignedSellerId: null,
          assignedSellerName: null,
          notes: null,
          followUpAt: null,
          createdAt: "2026-08-01T00:00:00.000Z",
        },
      ]);

      const result = await listCustomerInquiries("998901234567", actor);

      expect(backendRequest).toHaveBeenCalledWith("/seller/inquiries/by-phone", {
        accessToken: "tok",
        query: { phone: "998901234567" },
      });
      expect(result).toEqual([
        {
          id: "inq-1",
          message: "Need a filter",
          status: "NEW",
          assignedSellerId: null,
          assignedSellerName: null,
          productSku: "SKU-1",
          quantity: 2,
          notes: null,
          createdAt: new Date("2026-08-01T00:00:00.000Z"),
        },
      ]);
    });
  });
});
