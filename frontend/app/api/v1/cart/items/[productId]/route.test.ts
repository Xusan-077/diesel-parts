import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getSession: () => getSession() }));

const callBackendPhoneVerified = vi.fn();
vi.mock("@/lib/api/internal-backend", () => ({
  callBackendPhoneVerified: (...args: unknown[]) => callBackendPhoneVerified(...args),
}));

vi.mock("@/lib/auth/dal", () => ({ getStaffUser: vi.fn() }));

const { DELETE } = await import("./route");

function params(productId: string) {
  return { params: Promise.resolve({ productId }) };
}

beforeEach(() => {
  getSession.mockReset();
  callBackendPhoneVerified.mockReset();
  callBackendPhoneVerified.mockResolvedValue({ items: [] });
});

describe("DELETE /api/v1/cart/items/:productId", () => {
  it("answers 401 with no session", async () => {
    getSession.mockResolvedValue(null);
    expect((await DELETE(new Request("http://localhost"), params("p1"))).status).toBe(401);
  });

  it("proxies the removal", async () => {
    getSession.mockResolvedValue({ phone: "998901234567" });
    const response = await DELETE(new Request("http://localhost"), params("p1"));
    expect(response.status).toBe(200);
    expect(callBackendPhoneVerified).toHaveBeenCalledWith("998901234567", "carts/items/p1", {
      method: "DELETE",
    });
  });
});
