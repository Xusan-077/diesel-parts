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

const { GET } = await import("./route");

function params(orderId: string) {
  return { params: Promise.resolve({ orderId }) };
}

beforeEach(() => {
  getSession.mockReset();
  callBackendPhoneVerified.mockReset();
});

describe("GET /api/v1/checkout/orders/:orderId", () => {
  it("answers 401 with no session", async () => {
    getSession.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost"), params("ord-1"));

    expect(response.status).toBe(401);
    expect(callBackendPhoneVerified).not.toHaveBeenCalled();
  });

  it("proxies to backend/ with the session's verified phone", async () => {
    getSession.mockResolvedValue({ phone: "998901234567" });
    callBackendPhoneVerified.mockResolvedValue({
      orderNumber: "DP-1001",
      status: "NEW",
      paymentStatus: "UNPAID",
      latestPaymentStatus: "PENDING",
    });

    const response = await GET(new Request("http://localhost"), params("ord-1"));
    const body = await response.json();

    expect(callBackendPhoneVerified).toHaveBeenCalledWith("998901234567", "checkout/orders/ord-1");
    expect(body).toEqual({
      success: true,
      orderNumber: "DP-1001",
      status: "NEW",
      paymentStatus: "UNPAID",
      latestPaymentStatus: "PENDING",
    });
  });
});
