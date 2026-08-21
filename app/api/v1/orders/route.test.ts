import { beforeEach, describe, expect, it, vi } from "vitest";

const getStaffUser = vi.fn();
vi.mock("@/lib/auth/dal", () => ({ getStaffUser: () => getStaffUser() }));

const listOrders = vi.fn();
const createOrder = vi.fn();
vi.mock("@/lib/api/order-repository", () => ({
  listOrders: (...args: unknown[]) => listOrders(...args),
  createOrder: (...args: unknown[]) => createOrder(...args),
}));

const { GET, POST } = await import("./route");

const seller = { id: "seller-1", name: "S", email: "s@d.uz", role: "SELLER", discountLimit: 5 };
const emptyPage = { items: [], total: 0, page: 1, pageSize: 20, totalPages: 1 };

const validOrder = {
  customerId: "cus-1",
  items: [{ productId: "prod-1", qty: 2 }],
};

function get(query = ""): Request {
  return new Request("http://localhost/api/v1/orders" + (query ? "?" + query : ""));
}

function post(body: unknown): Request {
  return new Request("http://localhost/api/v1/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  getStaffUser.mockReset();
  listOrders.mockReset();
  createOrder.mockReset();
  listOrders.mockResolvedValue(emptyPage);
  createOrder.mockResolvedValue({ ok: true, id: "ord-1" });
});

describe("GET /api/v1/orders", () => {
  it("answers 401 for an anonymous caller and never reads", async () => {
    getStaffUser.mockResolvedValue(null);

    expect((await GET(get())).status).toBe(401);
    expect(listOrders).not.toHaveBeenCalled();
  });

  it("returns the page and passes the caller through for scoping", async () => {
    getStaffUser.mockResolvedValue(seller);

    const response = await GET(get("status=PENDING&customerId=cus-1"));

    expect(response.status).toBe(200);
    expect(listOrders.mock.calls[0][0]).toMatchObject({ id: "seller-1" });
    expect(listOrders.mock.calls[0][1]).toEqual({
      status: "PENDING",
      customerId: "cus-1",
      page: 1,
    });
  });

  it("answers 400 for a status outside the enum", async () => {
    getStaffUser.mockResolvedValue(seller);

    expect((await GET(get("status=SHIPPED"))).status).toBe(400);
    expect(listOrders).not.toHaveBeenCalled();
  });
});

describe("POST /api/v1/orders", () => {
  it("answers 401 for an anonymous caller and never writes", async () => {
    getStaffUser.mockResolvedValue(null);

    expect((await POST(post(validOrder))).status).toBe(401);
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("creates the order and answers 201", async () => {
    getStaffUser.mockResolvedValue(seller);

    const response = await POST(post(validOrder));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ success: true, id: "ord-1" });
    expect(createOrder).toHaveBeenCalledWith(validOrder, seller);
  });

  it("answers 400 for an order with no lines", async () => {
    getStaffUser.mockResolvedValue(seller);

    const response = await POST(post({ customerId: "cus-1", items: [] }));

    expect(response.status).toBe(400);
    expect((await response.json()).success).toBe(false);
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("answers 400 for a quantity below one", async () => {
    getStaffUser.mockResolvedValue(seller);

    const response = await POST(
      post({ customerId: "cus-1", items: [{ productId: "prod-1", qty: 0 }] }),
    );

    expect(response.status).toBe(400);
  });

  it("answers 400 for a negative unit price", async () => {
    getStaffUser.mockResolvedValue(seller);

    const response = await POST(
      post({ customerId: "cus-1", items: [{ productId: "prod-1", qty: 1, unitPrice: -5 }] }),
    );

    expect(response.status).toBe(400);
  });

  it("answers 400 for a body that is not JSON", async () => {
    getStaffUser.mockResolvedValue(seller);

    const response = await POST(post("not json"));

    expect(response.status).toBe(400);
    expect((await response.json()).errors._root).toBeDefined();
  });

  it("answers 404 for a customer the seller may not use", async () => {
    getStaffUser.mockResolvedValue(seller);
    createOrder.mockResolvedValue({ ok: false, reason: "customer_not_found" });

    expect((await POST(post(validOrder))).status).toBe(404);
  });

  it("answers 400 for a product that is missing or retired", async () => {
    getStaffUser.mockResolvedValue(seller);
    createOrder.mockResolvedValue({
      ok: false,
      reason: "product_not_found",
      productId: "prod-9",
    });

    const response = await POST(post(validOrder));

    expect(response.status).toBe(400);
    expect((await response.json()).errors._root[0]).toContain("prod-9");
  });

  it("answers 400 when a product priced on request arrives without a price", async () => {
    getStaffUser.mockResolvedValue(seller);
    createOrder.mockResolvedValue({ ok: false, reason: "price_required", productId: "prod-9" });

    expect((await POST(post(validOrder))).status).toBe(400);
  });

  it("answers 409 when the reference could not be issued", async () => {
    getStaffUser.mockResolvedValue(seller);
    createOrder.mockResolvedValue({ ok: false, reason: "number_conflict" });

    expect((await POST(post(validOrder))).status).toBe(409);
  });
});
