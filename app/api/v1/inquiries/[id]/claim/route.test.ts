import { beforeEach, describe, expect, it, vi } from "vitest";

const getStaffUser = vi.fn();
vi.mock("@/lib/auth/dal", () => ({ getStaffUser: () => getStaffUser() }));

const claimInquiry = vi.fn();
vi.mock("@/lib/api/inquiry-board-repository", () => ({
  claimInquiry: (...args: unknown[]) => claimInquiry(...args),
}));

const { POST } = await import("./route");

const seller = { id: "seller-1", name: "S", email: "s@d.uz", role: "SELLER", discountLimit: 5 };
const params = { params: Promise.resolve({ id: "inq-1" }) };

function request(): Request {
  return new Request("http://localhost/api/v1/inquiries/inq-1/claim", { method: "POST" });
}

beforeEach(() => {
  getStaffUser.mockReset();
  claimInquiry.mockReset();
  claimInquiry.mockResolvedValue({ ok: true, id: "inq-1" });
});

describe("POST /api/v1/inquiries/[id]/claim", () => {
  it("answers 401 for an anonymous caller and never claims", async () => {
    getStaffUser.mockResolvedValue(null);

    const response = await POST(request(), params);

    expect(response.status).toBe(401);
    expect(claimInquiry).not.toHaveBeenCalled();
  });

  it("claims the lead for the signed-in seller", async () => {
    getStaffUser.mockResolvedValue(seller);

    const response = await POST(request(), params);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, id: "inq-1" });
    expect(claimInquiry).toHaveBeenCalledWith("inq-1", seller);
  });

  it("answers 409 when another seller got there first", async () => {
    // The expected case, not an edge case. The loser has to be told the lead is
    // gone rather than shown a silent no-op.
    getStaffUser.mockResolvedValue(seller);
    claimInquiry.mockResolvedValue({ ok: false, reason: "taken" });

    const response = await POST(request(), params);

    expect(response.status).toBe(409);
    expect((await response.json()).success).toBe(false);
  });

  it("answers 404 for a lead that does not exist", async () => {
    getStaffUser.mockResolvedValue(seller);
    claimInquiry.mockResolvedValue({ ok: false, reason: "not_found" });

    expect((await POST(request(), params)).status).toBe(404);
  });
});
