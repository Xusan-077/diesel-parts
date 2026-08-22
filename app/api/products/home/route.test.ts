import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HomeProductsResponse } from "@/lib/product-collections";

const getProductsForHomeRows = vi.fn();
const listBrands = vi.fn();
const listCategories = vi.fn();
const getProductStats = vi.fn();

vi.mock("@/lib/api/product-repository", () => ({
  getProductsForHomeRows: (...args: unknown[]) => getProductsForHomeRows(...args),
  listBrands: (...args: unknown[]) => listBrands(...args),
  listCategories: (...args: unknown[]) => listCategories(...args),
}));

/*
 * Mocked for the same reason the degraded-page suite mocks it: it is the only
 * import in this tree that reaches `lib/db`, which throws at module scope
 * without a DATABASE_URL.
 */
vi.mock("@/lib/api/product-stats-repository", () => ({
  getProductStats: (...args: unknown[]) => getProductStats(...args),
}));

const { GET } = await import("./route");

function product(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    slug: id,
    name: { uz: id, ru: id, en: id },
    sku: id.toUpperCase(),
    oemNumbers: [],
    price: 100,
    categoryId: "forsunkalar",
    brandId: "cat",
    description: { uz: "", ru: "", en: "" },
    compatibleModels: [],
    stockStatus: "available",
    specs: [],
    imageLabels: [],
    ...overrides,
  };
}

function request(query = ""): Request {
  return new Request(`http://localhost/api/products/home?${query}`);
}

async function body(response: Response): Promise<HomeProductsResponse> {
  return (await response.json()) as HomeProductsResponse;
}

beforeEach(() => {
  vi.restoreAllMocks();
  getProductsForHomeRows.mockReset();
  listBrands.mockReset();
  listCategories.mockReset();
  getProductStats.mockReset();

  getProductsForHomeRows.mockResolvedValue({
    popular: [product("a")],
    newest: [product("b")],
    // Overlaps `popular` on purpose: the collections share parts, and the
    // response is built to describe each one once.
    bestSellers: [product("a")],
  });
  listBrands.mockResolvedValue([{ id: "cat", name: "CAT", logoLabel: "CAT" }]);
  listCategories.mockResolvedValue([
    {
      id: "forsunkalar",
      slug: "forsunkalar",
      name: { uz: "Forsunkalar", ru: "Форсунки", en: "Injectors" },
      parentId: null,
      order: 0,
      icon: null,
      type: "engine",
    },
  ]);
  getProductStats.mockResolvedValue(
    new Map([["a", { rating: 4.5, reviewCount: 2, soldCount: 7 }]]),
  );
});

describe("GET /api/products/home", () => {
  it("returns the three collections in one response", async () => {
    const payload = await body(await GET(request()));

    expect(Object.keys(payload.rows)).toEqual(["popular", "newest", "bestSellers"]);
    expect(payload.rows.popular.map((row) => row.id)).toEqual(["a"]);
    expect(payload.rows.newest.map((row) => row.id)).toEqual(["b"]);
  });

  it("asks for the default row size, and clamps a hand-edited limit", async () => {
    await GET(request());
    expect(getProductsForHomeRows).toHaveBeenCalledWith(8);

    await GET(request("limit=4"));
    expect(getProductsForHomeRows).toHaveBeenLastCalledWith(4);

    await GET(request("limit=9999"));
    expect(getProductsForHomeRows).toHaveBeenLastCalledWith(24);

    // A limit nobody could have meant falls back rather than 400s, the same way
    // the catalog query parser treats an edited URL.
    await GET(request("limit=nope"));
    expect(getProductsForHomeRows).toHaveBeenLastCalledWith(8);
  });

  it("resolves the card captions once per part, in the requested locale", async () => {
    const payload = await body(await GET(request("lang=ru")));

    expect(payload.meta.a).toEqual({ brandName: "CAT", categoryName: "Форсунки" });
    // Deduplicated: `a` is in two collections and was looked up as one id.
    expect(getProductStats).toHaveBeenCalledWith(["a", "b"]);
  });

  it("falls back to the default locale for an unknown lang", async () => {
    const payload = await body(await GET(request("lang=fr")));

    expect(payload.meta.a.categoryName).toBe("Forsunkalar");
  });

  it("carries the review figures for exactly the parts it returned", async () => {
    const payload = await body(await GET(request()));

    expect(payload.stats.a).toEqual({ rating: 4.5, reviewCount: 2, soldCount: 7 });
    // `b` has no reviews, and no row: the card reads a missing entry as the
    // zeros an unreviewed part gets.
    expect(payload.stats.b).toBeUndefined();
  });

  /*
   * The degradation policy the home page used to carry, moved behind the API.
   * The captions are worth less than the cards they sit under, so losing them
   * must not lose the row.
   */
  it("still answers when the brand, category and stats reads fail", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    listBrands.mockRejectedValue(new Error("Server has closed the connection"));
    listCategories.mockRejectedValue(new Error("Server has closed the connection"));
    getProductStats.mockRejectedValue(new Error("Server has closed the connection"));

    const response = await GET(request());
    const payload = await body(response);

    expect(response.status).toBe(200);
    expect(payload.rows.popular).toHaveLength(1);
    expect(payload.meta.a).toEqual({ brandName: "", categoryName: "" });
    expect(payload.stats).toEqual({});
  });

  /*
   * The products are what the rows *are*. An empty 200 would draw a shop with
   * nothing in it; a 503 is something the row can show a retry button for.
   */
  it("answers 503 when the catalog itself is unreachable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    getProductsForHomeRows.mockRejectedValue(new Error("Can't reach database server"));

    const response = await GET(request());

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "products_unavailable" });
  });
});
