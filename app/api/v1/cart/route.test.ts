import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getSession: () => getSession() }));

const callBackendPhoneVerified = vi.fn();
vi.mock("@/lib/api/internal-backend", () => ({
  callBackendPhoneVerified: (...args: unknown[]) => callBackendPhoneVerified(...args),
}));

// `route-auth` reaches the DAL, which loads the Prisma client, which refuses
// to construct without DATABASE_URL. This route only uses apiError, so
// standing the DAL in keeps the test free of a database.
vi.mock("@/lib/auth/dal", () => ({ getStaffUser: vi.fn() }));

const { GET, DELETE } = await import("./route");

beforeEach(() => {
  getSession.mockReset();
  callBackendPhoneVerified.mockReset();
});

describe("GET /api/v1/cart", () => {
  it("answers 401 with no session", async () => {
    getSession.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect(callBackendPhoneVerified).not.toHaveBeenCalled();
  });

  it("proxies to backend/ carts and returns its items", async () => {
    getSession.mockResolvedValue({ phone: "998901234567" });
    callBackendPhoneVerified.mockResolvedValue({ items: [{ productId: "p1", quantity: 2 }] });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      items: [{ productId: "p1", quantity: 2 }],
    });
    expect(callBackendPhoneVerified).toHaveBeenCalledWith("998901234567", "carts");
  });
});

describe("DELETE /api/v1/cart", () => {
  it("answers 401 with no session", async () => {
    getSession.mockResolvedValue(null);
    expect((await DELETE()).status).toBe(401);
  });

  it("proxies the clear", async () => {
    getSession.mockResolvedValue({ phone: "998901234567" });
    const response = await DELETE();
    expect(response.status).toBe(200);
    expect(callBackendPhoneVerified).toHaveBeenCalledWith("998901234567", "carts", {
      method: "DELETE",
    });
  });
});
