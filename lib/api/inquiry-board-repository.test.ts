import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("./backend-client", async () => {
  const actual = await vi.importActual<typeof import("./backend-client")>("./backend-client");
  return { ...actual, backendRequest: vi.fn() };
});
vi.mock("@/lib/auth/staff-session", () => ({ getStaffSession: vi.fn() }));

import { BackendApiError, backendRequest } from "./backend-client";
import { getStaffSession } from "@/lib/auth/staff-session";
import {
  claimInquiry,
  listInquiries,
  listInquiryBoard,
  updateInquiry,
} from "./inquiry-board-repository";
import { INQUIRY_COLUMNS } from "./inquiry-board";
import type { ScopeActor } from "./seller-scope";

const SESSION = {
  role: "DIRECTOR" as const,
  accessToken: "tok",
  refreshToken: "rt",
  accessTokenExpiresAt: Date.now() + 900_000,
};

const actor: ScopeActor = { id: "seller-1", role: "SELLER" };

function wireRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "inq-1",
    customerName: "Ali",
    phone: "998901234567",
    email: null,
    message: "Need a filter",
    productId: null,
    productSku: null,
    quantity: null,
    status: "NEW",
    source: "CONTACT_FORM",
    column: "new",
    assignedSellerId: null,
    assignedSellerName: null,
    notes: null,
    followUpAt: "2026-09-01T00:00:00.000Z",
    createdAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("inquiry-board-repository", () => {
  beforeEach(() => {
    vi.mocked(backendRequest).mockReset();
    vi.mocked(getStaffSession).mockReset();
    vi.mocked(getStaffSession).mockResolvedValue(SESSION);
  });

  describe("listInquiries", () => {
    it("forwards column/sellerId/page and maps meta + dates", async () => {
      vi.mocked(backendRequest).mockResolvedValue({
        data: [wireRow()],
        meta: { page: 2, limit: 20, total: 41, totalPages: 3 },
      });

      const result = await listInquiries(actor, {
        column: "in_progress",
        sellerId: "seller-9",
        page: 2,
      });

      expect(backendRequest).toHaveBeenCalledWith("/seller/inquiries", {
        accessToken: "tok",
        query: { column: "in_progress", sellerId: "seller-9", page: 2 },
      });
      expect(result.total).toBe(41);
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(20);
      expect(result.totalPages).toBe(3);
      expect(result.items[0].column).toBe("new");
      expect(result.items[0].createdAt).toBeInstanceOf(Date);
      expect(result.items[0].followUpAt).toBeInstanceOf(Date);
      expect(result.items[0].createdAt.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    });

    it("maps a null followUpAt to null", async () => {
      vi.mocked(backendRequest).mockResolvedValue({
        data: [wireRow({ followUpAt: null })],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      const result = await listInquiries(actor, { page: 1 });

      expect(result.items[0].followUpAt).toBeNull();
    });
  });

  describe("claimInquiry", () => {
    it("claims and reports ok", async () => {
      vi.mocked(backendRequest).mockResolvedValue({ id: "inq-1" });

      const result = await claimInquiry("inq-1", actor);

      expect(backendRequest).toHaveBeenCalledWith("/seller/inquiries/inq-1/claim", {
        method: "POST",
        accessToken: "tok",
      });
      expect(result).toEqual({ ok: true, id: "inq-1" });
    });

    it("maps a 404 to not_found", async () => {
      vi.mocked(backendRequest).mockRejectedValue(new BackendApiError("Not found", 404, "not_found"));

      expect(await claimInquiry("missing", actor)).toEqual({ ok: false, reason: "not_found" });
    });

    it("maps a 409 to taken", async () => {
      vi.mocked(backendRequest).mockRejectedValue(new BackendApiError("Conflict", 409, "conflict"));

      expect(await claimInquiry("inq-1", actor)).toEqual({ ok: false, reason: "taken" });
    });

    it("rethrows any other backend failure", async () => {
      vi.mocked(backendRequest).mockRejectedValue(new BackendApiError("Down", 503, "unavailable"));

      await expect(claimInquiry("inq-1", actor)).rejects.toThrow("Down");
    });
  });

  describe("updateInquiry", () => {
    it("sends status/notes/followUpAt including explicit null, reports ok", async () => {
      vi.mocked(backendRequest).mockResolvedValue({ id: "inq-1" });

      const result = await updateInquiry(
        "inq-1",
        { status: "WON", notes: null, followUpAt: null },
        actor,
      );

      expect(backendRequest).toHaveBeenCalledWith("/seller/inquiries/inq-1", {
        method: "PATCH",
        accessToken: "tok",
        body: { status: "WON", notes: null, followUpAt: null },
      });
      const body = vi.mocked(backendRequest).mock.calls[0][1]?.body as Record<string, unknown>;
      expect(body.notes).toBeNull();
      expect(body.followUpAt).toBeNull();
      expect(result).toEqual({ ok: true, id: "inq-1" });
    });

    it("maps a 404 to not_found", async () => {
      vi.mocked(backendRequest).mockRejectedValue(new BackendApiError("Not found", 404, "not_found"));

      expect(await updateInquiry("missing", { status: "LOST" }, actor)).toEqual({
        ok: false,
        reason: "not_found",
      });
    });

    it("rethrows any other backend failure", async () => {
      vi.mocked(backendRequest).mockRejectedValue(new BackendApiError("Bad", 400, "no_fields"));

      await expect(updateInquiry("inq-1", { status: "WON" }, actor)).rejects.toThrow("Bad");
    });
  });

  describe("listInquiryBoard", () => {
    it("maps every column's items through toRow and preserves each total", async () => {
      const board = Object.fromEntries(
        INQUIRY_COLUMNS.map((c, i) => [
          c,
          { items: [wireRow({ id: `inq-${c}`, column: c })], total: i + 1 },
        ]),
      );
      vi.mocked(backendRequest).mockResolvedValue(board);

      const result = await listInquiryBoard(actor);

      expect(backendRequest).toHaveBeenCalledWith("/seller/inquiries/board", {
        accessToken: "tok",
      });
      for (const [i, c] of INQUIRY_COLUMNS.entries()) {
        expect(result[c].total).toBe(i + 1);
        expect(result[c].items[0].id).toBe(`inq-${c}`);
        expect(result[c].items[0].createdAt).toBeInstanceOf(Date);
        expect(result[c].items[0].followUpAt).toBeInstanceOf(Date);
      }
    });
  });

  it("never sends an actor/_actor field in any body or query", async () => {
    vi.mocked(backendRequest).mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 1 },
    });
    await listInquiries(actor, { page: 1 });

    vi.mocked(backendRequest).mockResolvedValue({ id: "inq-1" });
    await claimInquiry("inq-1", actor);
    await updateInquiry("inq-1", { status: "WON" }, actor);

    vi.mocked(backendRequest).mockResolvedValue(
      Object.fromEntries(INQUIRY_COLUMNS.map((c) => [c, { items: [], total: 0 }])),
    );
    await listInquiryBoard(actor);

    for (const [, options] of vi.mocked(backendRequest).mock.calls) {
      const serialized = JSON.stringify(options ?? {});
      expect(serialized).not.toMatch(/actor/i);
      expect(serialized).not.toMatch(/seller-1/);
    }
  });
});
