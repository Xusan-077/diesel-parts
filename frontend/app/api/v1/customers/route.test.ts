import { beforeEach, describe, expect, it, vi } from "vitest";

const getStaffUser = vi.fn();
vi.mock("@/lib/auth/dal", () => ({ getStaffUser: () => getStaffUser() }));

const listCustomers = vi.fn();
const createCustomer = vi.fn();
vi.mock("@/lib/api/customer-repository", () => ({
  listCustomers: (...args: unknown[]) => listCustomers(...args),
  createCustomer: (...args: unknown[]) => createCustomer(...args),
}));

const { GET, POST } = await import("./route");

const seller = { id: "seller-1", name: "S", email: "s@d.uz", role: "SELLER", discountLimit: 5 };
const emptyPage = { items: [], total: 0, page: 1, pageSize: 20, totalPages: 1 };

const validCustomer = { name: "Anvar Karimov", phone: "+998901234567" };

function get(query = ""): Request {
  return new Request("http://localhost/api/v1/customers" + (query ? "?" + query : ""));
}

function post(body: unknown): Request {
  return new Request("http://localhost/api/v1/customers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  getStaffUser.mockReset();
  listCustomers.mockReset();
  createCustomer.mockReset();
  listCustomers.mockResolvedValue(emptyPage);
  createCustomer.mockResolvedValue({ ok: true, id: "cus-1" });
});

describe("GET /api/v1/customers", () => {
  it("answers 401 for an anonymous caller and never reads", async () => {
    getStaffUser.mockResolvedValue(null);

    expect((await GET(get())).status).toBe(401);
    expect(listCustomers).not.toHaveBeenCalled();
  });

  it("returns the seller's own book by default", async () => {
    getStaffUser.mockResolvedValue(seller);

    const response = await GET(get());

    expect(response.status).toBe(200);
    expect(listCustomers.mock.calls[0][1]).toEqual({ page: 1, pool: false });
  });

  it("switches to the unassigned pool on request", async () => {
    getStaffUser.mockResolvedValue(seller);
    await GET(get("pool=true&search=Karimov"));

    expect(listCustomers.mock.calls[0][1]).toEqual({ page: 1, pool: true, search: "Karimov" });
  });

  it("answers 400 for a pool flag that is not a boolean", async () => {
    getStaffUser.mockResolvedValue(seller);

    expect((await GET(get("pool=maybe"))).status).toBe(400);
    expect(listCustomers).not.toHaveBeenCalled();
  });
});

describe("POST /api/v1/customers", () => {
  it("answers 401 for an anonymous caller and never writes", async () => {
    getStaffUser.mockResolvedValue(null);

    expect((await POST(post(validCustomer))).status).toBe(401);
    expect(createCustomer).not.toHaveBeenCalled();
  });

  it("creates the customer and answers 201", async () => {
    getStaffUser.mockResolvedValue(seller);

    const response = await POST(post(validCustomer));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ success: true, id: "cus-1" });
    expect(createCustomer).toHaveBeenCalledWith(validCustomer, seller);
  });

  it("answers 400 without a name", async () => {
    getStaffUser.mockResolvedValue(seller);

    const response = await POST(post({ phone: "+998901234567" }));

    expect(response.status).toBe(400);
    expect((await response.json()).errors.name).toBeDefined();
    expect(createCustomer).not.toHaveBeenCalled();
  });

  it("answers 400 for an empty phone", async () => {
    getStaffUser.mockResolvedValue(seller);

    expect((await POST(post({ ...validCustomer, phone: "" }))).status).toBe(400);
  });

  it("answers 400 for an invalid email", async () => {
    getStaffUser.mockResolvedValue(seller);

    expect((await POST(post({ ...validCustomer, email: "not-an-email" }))).status).toBe(400);
  });

  it("answers 400 for a body that is not JSON", async () => {
    getStaffUser.mockResolvedValue(seller);

    const response = await POST(post("not json"));

    expect(response.status).toBe(400);
    expect((await response.json()).errors._root).toBeDefined();
  });
});
