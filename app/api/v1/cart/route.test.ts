import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getSession: () => getSession() }));

const getCart = vi.fn();
const clearCart = vi.fn();
vi.mock("@/lib/api/cart-repository", () => ({
  getCart: (...args: unknown[]) => getCart(...args),
  clearCart: (...args: unknown[]) => clearCart(...args),
}));

// `route-auth` reaches the DAL, which loads the Prisma client, which refuses
// to construct without DATABASE_URL. This route only uses apiError, so
// standing the DAL in keeps the test free of a database.
vi.mock("@/lib/auth/dal", () => ({ getStaffUser: vi.fn() }));

const { GET, DELETE } = await import("./route");

beforeEach(() => {
  getSession.mockReset();
  getCart.mockReset();
  clearCart.mockReset();
});

describe("GET /api/v1/cart", () => {
  it("answers 401 with no session", async () => {
    getSession.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect(getCart).not.toHaveBeenCalled();
  });

  it("returns the caller's cart", async () => {
    getSession.mockResolvedValue({ phone: "998901234567" });
    getCart.mockResolvedValue({ items: [{ productId: "p1", quantity: 2 }] });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      items: [{ productId: "p1", quantity: 2 }],
    });
    expect(getCart).toHaveBeenCalledWith("998901234567");
  });
});

describe("DELETE /api/v1/cart", () => {
  it("answers 401 with no session", async () => {
    getSession.mockResolvedValue(null);
    expect((await DELETE()).status).toBe(401);
    expect(clearCart).not.toHaveBeenCalled();
  });

  it("clears the cart", async () => {
    getSession.mockResolvedValue({ phone: "998901234567" });

    const response = await DELETE();

    expect(response.status).toBe(200);
    expect(clearCart).toHaveBeenCalledWith("998901234567");
  });
});
