import { beforeEach, describe, expect, it, vi } from "vitest";

const getProductsByIds = vi.fn();

vi.mock("@/lib/api/product-repository", () => ({
  getProductsByIds: (...args: unknown[]) => getProductsByIds(...args),
}));

const { GET } = await import("./route");

function request(query: string): Request {
  return new Request(`http://localhost/api/products/by-ids?${query}`);
}

describe("GET /api/products/by-ids", () => {
  // Calls accumulate across cases otherwise, and mock.calls[0] then belongs
  // to whichever test ran first.
  beforeEach(() => {
    getProductsByIds.mockReset();
  });

  it("returns an empty list for no ids without touching the database", async () => {
    const response = await GET(request("ids="));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [] });
    expect(getProductsByIds).not.toHaveBeenCalled();
  });

  it("splits a comma-separated id list", async () => {
    getProductsByIds.mockResolvedValue([]);
    await GET(request("ids=a,b,c&lang=uz"));

    expect(getProductsByIds).toHaveBeenCalledWith(["a", "b", "c"], "uz");
  });

  it("caps the number of ids so one request cannot ask for the whole catalog", async () => {
    getProductsByIds.mockResolvedValue([]);
    const ids = Array.from({ length: 100 }, (_, index) => `id-${index}`).join(",");
    await GET(request(`ids=${ids}`));

    expect(getProductsByIds.mock.calls[0][0]).toHaveLength(60);
  });

  it("falls back to the default locale for an unknown lang", async () => {
    getProductsByIds.mockResolvedValue([]);
    await GET(request("ids=a&lang=fr"));

    expect(getProductsByIds).toHaveBeenCalledWith(["a"], "uz");
  });

  it("drops empty segments from a trailing comma", async () => {
    getProductsByIds.mockResolvedValue([]);
    await GET(request("ids=a,,b,"));

    expect(getProductsByIds).toHaveBeenCalledWith(["a", "b"], "uz");
  });
});
