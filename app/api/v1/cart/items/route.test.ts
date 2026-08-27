import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getSession: () => getSession() }));

const setCartItem = vi.fn();
vi.mock("@/lib/api/cart-repository", () => ({
  setCartItem: (...args: unknown[]) => setCartItem(...args),
}));

// `route-auth` reaches the DAL, which loads the Prisma client, which refuses
// to construct without DATABASE_URL. This route only uses apiError and
// parseJsonBody, so standing the DAL in keeps the test free of a database.
vi.mock("@/lib/auth/dal", () => ({ getStaffUser: vi.fn() }));

const { POST } = await import("./route");

function post(body: unknown): Request {
  return new Request("http://localhost/api/v1/cart/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  getSession.mockReset();
  setCartItem.mockReset();
  setCartItem.mockResolvedValue({ items: [{ productId: "p1", quantity: 2 }] });
});

describe("POST /api/v1/cart/items", () => {
  it("answers 401 with no session", async () => {
    getSession.mockResolvedValue(null);
    expect((await POST(post({ productId: "p1", quantity: 2 }))).status).toBe(401);
    expect(setCartItem).not.toHaveBeenCalled();
  });

  it("adds the line and returns the updated cart", async () => {
    getSession.mockResolvedValue({ phone: "998901234567" });

    const response = await POST(post({ productId: "p1", quantity: 2 }));

    expect(response.status).toBe(200);
    expect(setCartItem).toHaveBeenCalledWith("998901234567", "p1", 2);
    expect(await response.json()).toEqual({
      success: true,
      items: [{ productId: "p1", quantity: 2 }],
    });
  });

  it("answers 400 for a quantity below one", async () => {
    getSession.mockResolvedValue({ phone: "998901234567" });
    expect((await POST(post({ productId: "p1", quantity: 0 }))).status).toBe(400);
  });

  it("answers 400 for a missing productId", async () => {
    getSession.mockResolvedValue({ phone: "998901234567" });
    expect((await POST(post({ quantity: 2 }))).status).toBe(400);
  });
});
