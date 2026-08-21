import { beforeEach, describe, expect, it, vi } from "vitest";

const getStaffUser = vi.fn();
vi.mock("@/lib/auth/dal", () => ({ getStaffUser: () => getStaffUser() }));

const updateInquiry = vi.fn();
vi.mock("@/lib/api/inquiry-board-repository", () => ({
  updateInquiry: (...args: unknown[]) => updateInquiry(...args),
}));

const { PATCH } = await import("./route");

const seller = { id: "seller-1", name: "S", email: "s@d.uz", role: "SELLER", discountLimit: 5 };
const params = { params: Promise.resolve({ id: "inq-1" }) };

function request(body: unknown): Request {
  return new Request("http://localhost/api/v1/inquiries/inq-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  getStaffUser.mockReset();
  updateInquiry.mockReset();
  updateInquiry.mockResolvedValue({ ok: true, id: "inq-1" });
});

describe("PATCH /api/v1/inquiries/[id]", () => {
  it("answers 401 for an anonymous caller and never writes", async () => {
    getStaffUser.mockResolvedValue(null);

    const response = await PATCH(request({ status: "WON" }), params);

    expect(response.status).toBe(401);
    expect(updateInquiry).not.toHaveBeenCalled();
  });

  it("moves a card the seller owns", async () => {
    getStaffUser.mockResolvedValue(seller);

    const response = await PATCH(request({ status: "WON" }), params);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, id: "inq-1" });
    expect(updateInquiry).toHaveBeenCalledWith("inq-1", { status: "WON" }, seller);
  });

  it("accepts a note and a follow-up date on their own", async () => {
    getStaffUser.mockResolvedValue(seller);

    const response = await PATCH(
      request({ notes: "Ertaga qo'ng'iroq", followUpAt: "2026-09-01" }),
      params,
    );

    expect(response.status).toBe(200);
    expect(updateInquiry.mock.calls[0][1]).toEqual({
      notes: "Ertaga qo'ng'iroq",
      followUpAt: "2026-09-01",
    });
  });

  it("accepts a cleared follow-up date", async () => {
    getStaffUser.mockResolvedValue(seller);

    expect((await PATCH(request({ followUpAt: null }), params)).status).toBe(200);
  });

  it("answers 404 for a lead assigned to another seller", async () => {
    // 404 rather than 403 on purpose: a refusal would confirm the row exists,
    // which tells one seller that another seller's lead is real.
    getStaffUser.mockResolvedValue(seller);
    updateInquiry.mockResolvedValue({ ok: false, reason: "not_found" });

    const response = await PATCH(request({ status: "WON" }), params);

    expect(response.status).toBe(404);
    expect((await response.json()).success).toBe(false);
  });

  it("answers 400 for an empty body, which asks for nothing", async () => {
    getStaffUser.mockResolvedValue(seller);

    const response = await PATCH(request({}), params);

    expect(response.status).toBe(400);
    expect((await response.json()).errors._root).toBeDefined();
    expect(updateInquiry).not.toHaveBeenCalled();
  });

  it("answers 400 for a status outside the enum", async () => {
    getStaffUser.mockResolvedValue(seller);

    expect((await PATCH(request({ status: "CLAIMED" }), params)).status).toBe(400);
  });

  it("answers 400 for a follow-up date that is not a date", async () => {
    getStaffUser.mockResolvedValue(seller);

    expect((await PATCH(request({ followUpAt: "next tuesday" }), params)).status).toBe(400);
  });

  it("answers 400 for a body that is not JSON", async () => {
    getStaffUser.mockResolvedValue(seller);

    const response = await PATCH(request("not json"), params);

    expect(response.status).toBe(400);
    expect((await response.json()).errors._root).toBeDefined();
  });
});
