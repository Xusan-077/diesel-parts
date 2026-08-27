import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyCode = vi.fn();
vi.mock("@/lib/auth/otp-store", () => ({ verifyCode: (...args: unknown[]) => verifyCode(...args) }));

const createSessionToken = vi.fn();
vi.mock("@/lib/auth/session-token", () => ({
  createSessionToken: (...args: unknown[]) => createSessionToken(...args),
  SESSION_TTL_SECONDS: 60 * 60 * 24 * 30,
}));

const mergeGuestCart = vi.fn();
vi.mock("@/lib/api/cart-repository", () => ({
  mergeGuestCart: (...args: unknown[]) => mergeGuestCart(...args),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "dp_pending_phone" ? { value: "998901234567" } : undefined),
  }),
}));

const { POST } = await import("./route");

function post(body: unknown): Request {
  return new Request("http://localhost/api/auth/verify-code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  verifyCode.mockReset();
  createSessionToken.mockReset();
  mergeGuestCart.mockReset();
  createSessionToken.mockResolvedValue("token");
  verifyCode.mockReturnValue({ ok: true });
  mergeGuestCart.mockResolvedValue({ items: [{ productId: "p1", quantity: 5 }] });
});

describe("POST /api/auth/verify-code", () => {
  it("merges the posted guest cart into the server cart and returns it", async () => {
    const response = await POST(
      post({ code: "123456", cart: { items: [{ productId: "p1", quantity: 3 }] } })
    );

    expect(response.status).toBe(200);
    expect(mergeGuestCart).toHaveBeenCalledWith("998901234567", [
      { productId: "p1", quantity: 3 },
    ]);
    expect(await response.json()).toEqual({
      success: true,
      cart: { items: [{ productId: "p1", quantity: 5 }] },
    });
  });

  it("merges an empty cart when the client sends none", async () => {
    await POST(post({ code: "123456" }));
    expect(mergeGuestCart).toHaveBeenCalledWith("998901234567", []);
  });

  it("does not merge when the code is invalid", async () => {
    verifyCode.mockReturnValue({ ok: false, reason: "invalid", attemptsLeft: 2 });

    const response = await POST(post({ code: "000000" }));

    expect(response.status).toBe(400);
    expect(mergeGuestCart).not.toHaveBeenCalled();
  });
});
