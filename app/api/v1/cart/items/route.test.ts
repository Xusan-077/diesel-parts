import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getSession: () => getSession() }));

const callBackendPhoneVerified = vi.fn();
vi.mock("@/lib/api/internal-backend", () => ({
  callBackendPhoneVerified: (...args: unknown[]) => callBackendPhoneVerified(...args),
}));

vi.mock("@/lib/auth/dal", () => ({ getStaffUser: vi.fn() }));

const { PUT } = await import("./route");

function put(body: unknown): Request {
  return new Request("http://localhost/api/v1/cart/items", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  getSession.mockReset();
  callBackendPhoneVerified.mockReset();
  callBackendPhoneVerified.mockResolvedValue({ items: [{ productId: "p1", quantity: 2 }] });
});

describe("PUT /api/v1/cart/items", () => {
  it("answers 401 with no session", async () => {
    getSession.mockResolvedValue(null);
    expect((await PUT(put({ productId: "p1", quantity: 2 }))).status).toBe(401);
  });

  it("proxies the set and returns the updated cart", async () => {
    getSession.mockResolvedValue({ phone: "998901234567" });

    const response = await PUT(put({ productId: "p1", quantity: 2 }));

    expect(response.status).toBe(200);
    expect(callBackendPhoneVerified).toHaveBeenCalledWith("998901234567", "carts/items", {
      method: "PUT",
      body: { productId: "p1", quantity: 2 },
    });
    expect(await response.json()).toEqual({
      success: true,
      items: [{ productId: "p1", quantity: 2 }],
    });
  });

  it("answers 400 for a quantity below one", async () => {
    getSession.mockResolvedValue({ phone: "998901234567" });
    expect((await PUT(put({ productId: "p1", quantity: 0 }))).status).toBe(400);
  });

  it("answers 400 for a missing productId", async () => {
    getSession.mockResolvedValue({ phone: "998901234567" });
    expect((await PUT(put({ quantity: 2 }))).status).toBe(400);
  });
});
