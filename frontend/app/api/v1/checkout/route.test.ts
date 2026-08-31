import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getSession: () => getSession() }));

const callBackendPhoneVerified = vi.fn();
vi.mock("@/lib/api/internal-backend", () => ({
  callBackendPhoneVerified: (...args: unknown[]) => callBackendPhoneVerified(...args),
}));

// `route-auth` reaches the DAL, which loads the Prisma client, which refuses
// to construct without DATABASE_URL. This route only uses apiError/parseJsonBody,
// so standing the DAL in keeps the test free of a database.
vi.mock("@/lib/auth/dal", () => ({ getStaffUser: vi.fn() }));

const { POST } = await import("./route");

function post(body: unknown): Request {
  return new Request("http://localhost/api/v1/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const ORIGINAL_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

beforeEach(() => {
  getSession.mockReset();
  callBackendPhoneVerified.mockReset();
  callBackendPhoneVerified.mockResolvedValue({
    order: { id: "ord-1", orderNumber: "DP-1001" },
    checkoutUrl: "https://checkout.paycom.uz/xyz",
  });
  process.env.NEXT_PUBLIC_SITE_URL = "https://www.diesel-parts.uz";
});

afterEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL_SITE_URL;
});

const basePayload = {
  firstName: "Aziz",
  lastName: "Karimov",
  deliveryMethod: "PICKUP",
  termsAccepted: true,
  paymentMethod: "ONLINE",
};

describe("POST /api/v1/checkout", () => {
  it("answers 401 with no session", async () => {
    getSession.mockResolvedValue(null);
    expect((await POST(post(basePayload))).status).toBe(401);
    expect(callBackendPhoneVerified).not.toHaveBeenCalled();
  });

  it("proxies the checkout request and returns the order plus checkout URL", async () => {
    getSession.mockResolvedValue({ phone: "998901234567" });

    const response = await POST(post(basePayload));

    expect(response.status).toBe(200);
    expect(callBackendPhoneVerified).toHaveBeenCalledWith("998901234567", "checkout", {
      method: "POST",
      body: { ...basePayload, returnBaseUrl: "https://www.diesel-parts.uz" },
    });
    expect(await response.json()).toEqual({
      success: true,
      order: { id: "ord-1", orderNumber: "DP-1001" },
      checkoutUrl: "https://checkout.paycom.uz/xyz",
    });
  });

  it("answers 400 for a payment method other than ONLINE", async () => {
    getSession.mockResolvedValue({ phone: "998901234567" });
    expect(
      (await POST(post({ ...basePayload, paymentMethod: "BANK_TRANSFER" }))).status,
    ).toBe(400);
    expect(callBackendPhoneVerified).not.toHaveBeenCalled();
  });
});
