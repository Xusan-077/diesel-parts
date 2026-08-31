import { beforeEach, describe, expect, it, vi } from "vitest";

const getStaffUser = vi.fn();
vi.mock("@/lib/auth/dal", () => ({ getStaffUser: () => getStaffUser() }));

const claimCustomer = vi.fn();
vi.mock("@/lib/api/customer-repository", () => ({
  claimCustomer: (...args: unknown[]) => claimCustomer(...args),
}));

const { POST } = await import("./route");

const seller = { id: "seller-1", name: "S", email: "s@d.uz", role: "SELLER", discountLimit: 5 };
const params = { params: Promise.resolve({ id: "cus-1" }) };

function request(): Request {
  return new Request("http://localhost/api/v1/customers/cus-1/claim", { method: "POST" });
}

beforeEach(() => {
  getStaffUser.mockReset();
  claimCustomer.mockReset();
  claimCustomer.mockResolvedValue({ ok: true, id: "cus-1" });
});

describe("POST /api/v1/customers/[id]/claim", () => {
  it("answers 401 for an anonymous caller and never claims", async () => {
    getStaffUser.mockResolvedValue(null);

    expect((await POST(request(), params)).status).toBe(401);
    expect(claimCustomer).not.toHaveBeenCalled();
  });

  it("takes an unassigned account into the seller's book", async () => {
    getStaffUser.mockResolvedValue(seller);

    const response = await POST(request(), params);

    expect(response.status).toBe(200);
    expect(claimCustomer).toHaveBeenCalledWith("cus-1", seller);
  });

  it("answers 409 when the account is already somebody's", async () => {
    getStaffUser.mockResolvedValue(seller);
    claimCustomer.mockResolvedValue({ ok: false, reason: "taken" });

    expect((await POST(request(), params)).status).toBe(409);
  });

  it("answers 404 for an account that does not exist", async () => {
    getStaffUser.mockResolvedValue(seller);
    claimCustomer.mockResolvedValue({ ok: false, reason: "not_found" });

    expect((await POST(request(), params)).status).toBe(404);
  });
});
