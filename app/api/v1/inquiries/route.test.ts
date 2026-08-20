import { beforeEach, describe, expect, it, vi } from "vitest";

const getStaffUser = vi.fn();
vi.mock("@/lib/auth/dal", () => ({ getStaffUser: () => getStaffUser() }));

// The repository imports the Prisma client, which refuses to load without
// DATABASE_URL. Mocking it keeps these route tests free of a database.
const listInquiries = vi.fn();
vi.mock("@/lib/api/inquiry-board-repository", () => ({
  listInquiries: (...args: unknown[]) => listInquiries(...args),
}));

const { GET } = await import("./route");

const seller = { id: "seller-1", name: "S", email: "s@d.uz", role: "SELLER", discountLimit: 5 };
const director = { id: "dir-1", name: "D", email: "d@d.uz", role: "DIRECTOR", discountLimit: 100 };

const emptyPage = { items: [], total: 0, page: 1, pageSize: 20, totalPages: 1 };

function request(query = ""): Request {
  return new Request("http://localhost/api/v1/inquiries" + (query ? "?" + query : ""));
}

beforeEach(() => {
  getStaffUser.mockReset();
  listInquiries.mockReset();
  listInquiries.mockResolvedValue(emptyPage);
});

describe("GET /api/v1/inquiries", () => {
  it("answers 401 for an anonymous caller and never reads", async () => {
    getStaffUser.mockResolvedValue(null);

    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(listInquiries).not.toHaveBeenCalled();
  });

  it("returns the page for a signed-in seller", async () => {
    getStaffUser.mockResolvedValue(seller);

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, ...emptyPage });
  });

  it("passes the caller through, so the repository scopes the rows", async () => {
    getStaffUser.mockResolvedValue(seller);
    await GET(request());

    expect(listInquiries.mock.calls[0][0]).toMatchObject({ id: "seller-1", role: "SELLER" });
  });

  it("answers 400 for a column that is not one of the five", async () => {
    getStaffUser.mockResolvedValue(seller);

    const response = await GET(request("column=parked"));

    expect(response.status).toBe(400);
    expect((await response.json()).success).toBe(false);
    expect(listInquiries).not.toHaveBeenCalled();
  });

  it("answers 400 for a page below one", async () => {
    getStaffUser.mockResolvedValue(seller);

    expect((await GET(request("page=0"))).status).toBe(400);
  });

  it("forwards a column filter and a coerced page", async () => {
    getStaffUser.mockResolvedValue(director);
    await GET(request("column=claimed&page=2&sellerId=seller-9"));

    expect(listInquiries.mock.calls[0][1]).toEqual({
      column: "claimed",
      page: 2,
      sellerId: "seller-9",
    });
  });
});
