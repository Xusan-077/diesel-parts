import { beforeEach, describe, expect, it, vi } from "vitest";

const getStaffUser = vi.fn();
vi.mock("@/lib/auth/dal", () => ({ getStaffUser: () => getStaffUser() }));

const getOrder = vi.fn();
const updateOrder = vi.fn();
vi.mock("@/lib/api/order-repository", () => ({
  getOrder: (...args: unknown[]) => getOrder(...args),
  updateOrder: (...args: unknown[]) => updateOrder(...args),
}));

const { GET, PATCH } = await import("./route");

const seller = { id: "seller-1", name: "S", email: "s@d.uz", role: "SELLER", discountLimit: 5 };
const params = { params: Promise.resolve({ id: "ord-1" }) };

function request(body: unknown): Request {
  return new Request("http://localhost/api/v1/orders/ord-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  getStaffUser.mockReset();
  getOrder.mockReset();
  updateOrder.mockReset();
  getOrder.mockResolvedValue({ id: "ord-1", orderNumber: "DP-2026-0001" });
  updateOrder.mockResolvedValue({ ok: true, id: "ord-1" });
});

describe("GET /api/v1/orders/[id]", () => {
  it("answers 401 for an anonymous caller", async () => {
    getStaffUser.mockResolvedValue(null);

    expect((await GET(new Request("http://localhost"), params)).status).toBe(401);
    expect(getOrder).not.toHaveBeenCalled();
  });

  it("returns the order with its lines", async () => {
    getStaffUser.mockResolvedValue(seller);

    const response = await GET(new Request("http://localhost"), params);

    expect(response.status).toBe(200);
    expect((await response.json()).order.orderNumber).toBe("DP-2026-0001");
  });

  it("answers 404 for another seller's order", async () => {
    getStaffUser.mockResolvedValue(seller);
    getOrder.mockResolvedValue(null);

    expect((await GET(new Request("http://localhost"), params)).status).toBe(404);
  });
});

describe("PATCH /api/v1/orders/[id]", () => {
  it("answers 401 for an anonymous caller and never writes", async () => {
    getStaffUser.mockResolvedValue(null);

    expect((await PATCH(request({ status: "PENDING" }), params)).status).toBe(401);
    expect(updateOrder).not.toHaveBeenCalled();
  });

  it("moves the order along", async () => {
    getStaffUser.mockResolvedValue(seller);

    const response = await PATCH(request({ status: "PENDING" }), params);

    expect(response.status).toBe(200);
    expect(updateOrder).toHaveBeenCalledWith("ord-1", { status: "PENDING" }, seller);
  });

  it("answers 409 for a transition the lifecycle does not allow", async () => {
    getStaffUser.mockResolvedValue(seller);
    updateOrder.mockResolvedValue({
      ok: false,
      reason: "illegal_transition",
      from: "DRAFT",
      to: "COMPLETED",
    });

    const response = await PATCH(request({ status: "COMPLETED" }), params);

    expect(response.status).toBe(409);
    expect((await response.json()).errors._root[0]).toContain("COMPLETED");
  });

  it("answers 409 when the lines are edited after CONFIRMED", async () => {
    // From CONFIRMED on the order is the record of an agreement; only its
    // status may still move.
    getStaffUser.mockResolvedValue(seller);
    updateOrder.mockResolvedValue({ ok: false, reason: "locked" });

    const response = await PATCH(
      request({ items: [{ productId: "prod-1", qty: 1 }] }),
      params,
    );

    expect(response.status).toBe(409);
  });

  it("answers 404 for another seller's order", async () => {
    getStaffUser.mockResolvedValue(seller);
    updateOrder.mockResolvedValue({ ok: false, reason: "not_found" });

    expect((await PATCH(request({ status: "PENDING" }), params)).status).toBe(404);
  });

  it("answers 400 for an empty body", async () => {
    getStaffUser.mockResolvedValue(seller);

    const response = await PATCH(request({}), params);

    expect(response.status).toBe(400);
    expect((await response.json()).errors._root).toBeDefined();
    expect(updateOrder).not.toHaveBeenCalled();
  });

  it("answers 400 for a status outside the enum", async () => {
    getStaffUser.mockResolvedValue(seller);

    expect((await PATCH(request({ status: "SHIPPED" }), params)).status).toBe(400);
  });

  it("answers 400 for a re-line with no lines in it", async () => {
    getStaffUser.mockResolvedValue(seller);

    expect((await PATCH(request({ items: [] }), params)).status).toBe(400);
  });
});
