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

/** The body of the last `callBackendPhoneVerified` call. */
function forwardedBody(): Record<string, unknown> {
  return callBackendPhoneVerified.mock.calls[0][2].body as Record<string, unknown>;
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

/** A minimal valid pickup order as the browser posts it. Backend's
 *  `CreateCheckoutDto` accepts every one of these fields unchanged. */
const basePayload = {
  firstName: "Aziz",
  lastName: "Karimov",
  phone: "90 123 45 67",
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

  it("forwards the per-order contact phone to the backend", async () => {
    getSession.mockResolvedValue({ phone: "998901234567" });

    await POST(post(basePayload));

    expect(forwardedBody().phone).toBe("90 123 45 67");
  });

  it("answers 400 when the contact phone is missing or incomplete", async () => {
    getSession.mockResolvedValue({ phone: "998901234567" });
    expect((await POST(post({ ...basePayload, phone: "90 12" }))).status).toBe(400);
    expect(callBackendPhoneVerified).not.toHaveBeenCalled();
  });

  it("rejects an unknown payment method", async () => {
    getSession.mockResolvedValue({ phone: "998901234567" });
    expect(
      (await POST(post({ ...basePayload, paymentMethod: "BANK_TRANSFER" }))).status,
    ).toBe(400);
    expect(callBackendPhoneVerified).not.toHaveBeenCalled();
  });

  it("passes a cash pickup order through unchanged", async () => {
    getSession.mockResolvedValue({ phone: "998901234567" });

    const response = await POST(post({ ...basePayload, paymentMethod: "CASH" }));

    expect(response.status).toBe(200);
    expect(forwardedBody().paymentMethod).toBe("CASH");
  });

  it("rejects a cash order once delivery is chosen", async () => {
    getSession.mockResolvedValue({ phone: "998901234567" });

    const response = await POST(
      post({
        ...basePayload,
        paymentMethod: "CASH",
        deliveryMethod: "DELIVERY",
        region: "samarkand",
        district: "Urgut",
        street: "Amir Temur 12",
        house: "5",
      }),
    );

    expect(response.status).toBe(400);
    expect(callBackendPhoneVerified).not.toHaveBeenCalled();
  });

  it("resolves the region slug to its label for a delivery order", async () => {
    getSession.mockResolvedValue({ phone: "998901234567" });

    await POST(
      post({
        ...basePayload,
        deliveryMethod: "DELIVERY",
        paymentMethod: "SELLER_AGREEMENT",
        region: "samarkand",
        district: "Urgut",
        street: "Amir Temur 12",
        house: "5",
        apartment: "5",
      }),
    );

    const body = forwardedBody();
    expect(body.region).toBe("Samarqand viloyati");
    expect(body.district).toBe("Urgut");
    expect(body.street).toBe("Amir Temur 12");
    expect(body.house).toBe("5");
    expect(body.paymentMethod).toBe("SELLER_AGREEMENT");
  });
});
