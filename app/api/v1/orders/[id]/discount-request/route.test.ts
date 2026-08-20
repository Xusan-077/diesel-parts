import { beforeEach, describe, expect, it, vi } from "vitest";

const getStaffUser = vi.fn();
vi.mock("@/lib/auth/dal", () => ({ getStaffUser: () => getStaffUser() }));

const requestOrderDiscount = vi.fn();
vi.mock("@/lib/api/order-repository", () => ({
  requestOrderDiscount: (...args: unknown[]) => requestOrderDiscount(...args),
}));

const { POST } = await import("./route");

const seller = { id: "seller-1", name: "S", email: "s@d.uz", role: "SELLER", discountLimit: 5 };
const params = { params: Promise.resolve({ id: "ord-1" }) };

function request(body: unknown): Request {
  return new Request("http://localhost/api/v1/orders/ord-1/discount-request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  getStaffUser.mockReset();
  requestOrderDiscount.mockReset();
  requestOrderDiscount.mockResolvedValue({ ok: true, kind: "immediate", totalAmount: 950 });
});

describe("POST /api/v1/orders/[id]/discount-request", () => {
  it("answers 401 for an anonymous caller and never writes", async () => {
    getStaffUser.mockResolvedValue(null);

    expect((await POST(request({ percent: 3 }), params)).status).toBe(401);
    expect(requestOrderDiscount).not.toHaveBeenCalled();
  });

  it("applies a discount inside the seller's limit at once", async () => {
    getStaffUser.mockResolvedValue(seller);

    const response = await POST(request({ percent: 3 }), params);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      kind: "immediate",
      totalAmount: 950,
    });
  });

  it("passes the caller through, so the repository reads their own limit", async () => {
    getStaffUser.mockResolvedValue(seller);
    await POST(request({ percent: 3, reason: "Doimiy mijoz" }), params);

    expect(requestOrderDiscount).toHaveBeenCalledWith(
      "ord-1",
      { percent: 3, reason: "Doimiy mijoz" },
      seller,
    );
  });

  it("answers 201 with the request id when the limit is exceeded", async () => {
    getStaffUser.mockResolvedValue(seller);
    requestOrderDiscount.mockResolvedValue({
      ok: true,
      kind: "needs_approval",
      requestId: "dr-1",
    });

    const response = await POST(request({ percent: 20 }), params);

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      success: true,
      kind: "needs_approval",
      requestId: "dr-1",
    });
  });

  it("answers 409 when a request is already waiting on this order", async () => {
    getStaffUser.mockResolvedValue(seller);
    requestOrderDiscount.mockResolvedValue({ ok: false, reason: "pending_exists" });

    expect((await POST(request({ percent: 20 }), params)).status).toBe(409);
  });

  it("answers 409 for an order that is past CONFIRMED", async () => {
    getStaffUser.mockResolvedValue(seller);
    requestOrderDiscount.mockResolvedValue({ ok: false, reason: "locked" });

    expect((await POST(request({ percent: 3 }), params)).status).toBe(409);
  });

  it("answers 404 for another seller's order", async () => {
    getStaffUser.mockResolvedValue(seller);
    requestOrderDiscount.mockResolvedValue({ ok: false, reason: "not_found" });

    expect((await POST(request({ percent: 3 }), params)).status).toBe(404);
  });

  it("answers 400 for a percent above 100", async () => {
    getStaffUser.mockResolvedValue(seller);

    const response = await POST(request({ percent: 120 }), params);

    expect(response.status).toBe(400);
    expect((await response.json()).errors.percent).toBeDefined();
    expect(requestOrderDiscount).not.toHaveBeenCalled();
  });

  it("answers 400 for a negative percent", async () => {
    getStaffUser.mockResolvedValue(seller);

    expect((await POST(request({ percent: -5 }), params)).status).toBe(400);
  });

  it("answers 400 when the percent is missing", async () => {
    getStaffUser.mockResolvedValue(seller);

    expect((await POST(request({ reason: "Doimiy mijoz" }), params)).status).toBe(400);
  });

  it("answers 400 for a body that is not JSON", async () => {
    getStaffUser.mockResolvedValue(seller);

    const response = await POST(request("not json"), params);

    expect(response.status).toBe(400);
    expect((await response.json()).errors._root).toBeDefined();
  });
});
