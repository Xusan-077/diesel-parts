import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getSession: () => getSession() }));

const setCartItem = vi.fn();
const removeCartItem = vi.fn();
vi.mock("@/lib/api/cart-repository", () => ({
  setCartItem: (...args: unknown[]) => setCartItem(...args),
  removeCartItem: (...args: unknown[]) => removeCartItem(...args),
}));

// `route-auth` reaches the DAL, which loads the Prisma client, which refuses
// to construct without DATABASE_URL. This route only uses apiError and
// parseJsonBody, so standing the DAL in keeps the test free of a database.
vi.mock("@/lib/auth/dal", () => ({ getStaffUser: vi.fn() }));

const { PATCH, DELETE } = await import("./route");

function patch(body: unknown): Request {
  return new Request("http://localhost/api/v1/cart/items/p1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function params(productId: string) {
  return { params: Promise.resolve({ productId }) };
}

beforeEach(() => {
  getSession.mockReset();
  setCartItem.mockReset();
  removeCartItem.mockReset();
  setCartItem.mockResolvedValue({ items: [] });
  removeCartItem.mockResolvedValue({ items: [] });
});

describe("PATCH /api/v1/cart/items/:productId", () => {
  it("answers 401 with no session", async () => {
    getSession.mockResolvedValue(null);
    expect((await PATCH(patch({ quantity: 3 }), params("p1"))).status).toBe(401);
  });

  it("sets the quantity", async () => {
    getSession.mockResolvedValue({ phone: "998901234567" });
    const response = await PATCH(patch({ quantity: 3 }), params("p1"));
    expect(response.status).toBe(200);
    expect(setCartItem).toHaveBeenCalledWith("998901234567", "p1", 3);
  });

  it("answers 400 for a quantity below one", async () => {
    getSession.mockResolvedValue({ phone: "998901234567" });
    expect((await PATCH(patch({ quantity: 0 }), params("p1"))).status).toBe(400);
  });
});

describe("DELETE /api/v1/cart/items/:productId", () => {
  it("answers 401 with no session", async () => {
    getSession.mockResolvedValue(null);
    expect((await DELETE(new Request("http://localhost"), params("p1"))).status).toBe(401);
  });

  it("removes the line", async () => {
    getSession.mockResolvedValue({ phone: "998901234567" });
    const response = await DELETE(new Request("http://localhost"), params("p1"));
    expect(response.status).toBe(200);
    expect(removeCartItem).toHaveBeenCalledWith("998901234567", "p1");
  });
});
