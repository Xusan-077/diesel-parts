import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  paginate,
  parseProductQuery,
} from "./product-query";

function query(search: string) {
  return parseProductQuery(new URLSearchParams(search));
}

describe("parseProductQuery", () => {
  it("applies defaults for an empty query string", () => {
    expect(query("")).toEqual({
      q: "",
      brandId: "all",
      categoryId: "all",
      categoryIds: undefined,
      availability: "all",
      sort: "newest",
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      lang: "uz",
    });
  });

  it("reads the supported values", () => {
    const result = query("q=turbo&brand=cat&category=injector&availability=limited&sort=name-asc&page=3&pageSize=20&lang=en");
    expect(result).toMatchObject({
      q: "turbo",
      brandId: "cat",
      categoryId: "injector",
      availability: "limited",
      sort: "name-asc",
      page: 3,
      pageSize: 20,
      lang: "en",
    });
  });

  it("trims the search term", () => {
    expect(query("q=%20%20turbo%20%20").q).toBe("turbo");
  });

  it("falls back instead of erroring on unknown enum values", () => {
    const result = query("availability=teleported&sort=by-vibes&lang=fr");
    expect(result.availability).toBe("all");
    expect(result.sort).toBe("newest");
    expect(result.lang).toBe("uz");
  });

  it("clamps out-of-range paging values", () => {
    expect(query("page=0").page).toBe(1);
    expect(query("page=-5").page).toBe(1);
    expect(query("page=abc").page).toBe(1);
    expect(query(`pageSize=9999`).pageSize).toBe(MAX_PAGE_SIZE);
    expect(query("pageSize=0").pageSize).toBe(1);
  });

  it("collects repeated categoryIds", () => {
    expect(query("categoryIds=injector&categoryIds=piston").categoryIds).toEqual([
      "injector",
      "piston",
    ]);
  });

  it("keeps an empty categoryIds scope distinct from no scope", () => {
    expect(query("").categoryIds).toBeUndefined();
    expect(query("categoryIds=").categoryIds).toEqual([]);
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 25 }, (_, index) => index + 1);

  it("returns the requested slice", () => {
    expect(paginate(items, 2, 10).items).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  });

  it("reports totals", () => {
    const page = paginate(items, 1, 10);
    expect(page.total).toBe(25);
    expect(page.totalPages).toBe(3);
  });

  it("clamps a page beyond the end to the last page", () => {
    expect(paginate(items, 99, 10).page).toBe(3);
    expect(paginate(items, 99, 10).items).toEqual([21, 22, 23, 24, 25]);
  });

  it("clamps a page below one", () => {
    expect(paginate(items, 0, 10).page).toBe(1);
  });

  it("handles an empty list without dividing by zero", () => {
    expect(paginate([], 1, 10)).toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    });
  });
});
