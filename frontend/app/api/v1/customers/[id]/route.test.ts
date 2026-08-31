import { beforeEach, describe, expect, it, vi } from "vitest";

const getStaffUser = vi.fn();
vi.mock("@/lib/auth/dal", () => ({ getStaffUser: () => getStaffUser() }));

const getCustomer = vi.fn();
const updateCustomer = vi.fn();
vi.mock("@/lib/api/customer-repository", () => ({
  getCustomer: (...args: unknown[]) => getCustomer(...args),
  updateCustomer: (...args: unknown[]) => updateCustomer(...args),
}));

const { GET, PATCH } = await import("./route");

const seller = { id: "seller-1", name: "S", email: "s@d.uz", role: "SELLER", discountLimit: 5 };
const params = { params: Promise.resolve({ id: "cus-1" }) };

function request(body: unknown): Request {
  return new Request("http://localhost/api/v1/customers/cus-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  getStaffUser.mockReset();
  getCustomer.mockReset();
  updateCustomer.mockReset();
  getCustomer.mockResolvedValue({ id: "cus-1", name: "Anvar" });
  updateCustomer.mockResolvedValue({ ok: true, id: "cus-1" });
});

describe("GET /api/v1/customers/[id]", () => {
  it("answers 401 for an anonymous caller", async () => {
    getStaffUser.mockResolvedValue(null);

    expect((await GET(new Request("http://localhost"), params)).status).toBe(401);
    expect(getCustomer).not.toHaveBeenCalled();
  });

  it("returns a customer the caller may see", async () => {
    getStaffUser.mockResolvedValue(seller);

    const response = await GET(new Request("http://localhost"), params);

    expect(response.status).toBe(200);
    expect((await response.json()).customer).toEqual({ id: "cus-1", name: "Anvar" });
  });

  it("answers 404 for another seller's customer", async () => {
    getStaffUser.mockResolvedValue(seller);
    getCustomer.mockResolvedValue(null);

    expect((await GET(new Request("http://localhost"), params)).status).toBe(404);
  });
});

describe("PATCH /api/v1/customers/[id]", () => {
  it("answers 401 for an anonymous caller and never writes", async () => {
    getStaffUser.mockResolvedValue(null);

    expect((await PATCH(request({ name: "Anvar" }), params)).status).toBe(401);
    expect(updateCustomer).not.toHaveBeenCalled();
  });

  it("edits one field without resending the rest", async () => {
    getStaffUser.mockResolvedValue(seller);

    const response = await PATCH(request({ notes: "To'lov kutilmoqda" }), params);

    expect(response.status).toBe(200);
    expect(updateCustomer).toHaveBeenCalledWith("cus-1", { notes: "To'lov kutilmoqda" }, seller);
  });

  it("answers 404 for a customer the seller does not own", async () => {
    // Reading a pooled customer is allowed; changing one is not. The answer is
    // 404 so it cannot be used to probe which accounts exist.
    getStaffUser.mockResolvedValue(seller);
    updateCustomer.mockResolvedValue({ ok: false, reason: "not_found" });

    expect((await PATCH(request({ name: "Anvar" }), params)).status).toBe(404);
  });

  it("answers 400 for an empty body", async () => {
    getStaffUser.mockResolvedValue(seller);

    const response = await PATCH(request({}), params);

    expect(response.status).toBe(400);
    expect((await response.json()).errors._root).toBeDefined();
    expect(updateCustomer).not.toHaveBeenCalled();
  });

  it("answers 400 for a name cleared to an empty string", async () => {
    getStaffUser.mockResolvedValue(seller);

    expect((await PATCH(request({ name: "" }), params)).status).toBe(400);
  });
});
