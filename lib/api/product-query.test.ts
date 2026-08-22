import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  buildPage,
  pageSkip,
  parseProductQuery,
} from "./product-query";

function query(search: string) {
  return parseProductQuery(new URLSearchParams(search));
}

describe("parseProductQuery", () => {
  it("applies defaults for an empty query string", () => {
    expect(query("")).toEqual({
      q: "",
      brandIds: [],
      categoryId: "all",
      categoryIds: undefined,
      availability: "all",
      priceMin: null,
      priceMax: null,
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
      brandIds: ["cat"],
      categoryId: "injector",
      availability: "limited",
      sort: "name-asc",
      page: 3,
      pageSize: 20,
      lang: "en",
    });
  });

  it("reads every ticked brand", () => {
    expect(query("brand=cat&brand=volvo").brandIds).toEqual(["cat", "volvo"]);
  });

  it("treats the old single-select sentinel as no brand filter", () => {
    // The sidebar used to send `brand=all` from a <select>. A bookmark from
    // then must still mean "every brand", not a brand with the id "all".
    expect(query("brand=all").brandIds).toEqual([]);
  });

  it("reads the price bounds", () => {
    expect(query("priceMin=500000&priceMax=2000000")).toMatchObject({
      priceMin: 500_000,
      priceMax: 2_000_000,
    });
  });

  it("drops a price bound nobody could have meant", () => {
    // Widening back out beats clamping to zero: a bound that cannot be read is
    // not a narrowing the reader asked for.
    expect(query("priceMin=abc&priceMax=-5")).toMatchObject({ priceMin: null, priceMax: null });
  });

  it("reads a hand-reversed price range the way it was meant", () => {
    expect(query("priceMin=2000000&priceMax=500000")).toMatchObject({
      priceMin: 500_000,
      priceMax: 2_000_000,
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


describe("buildPage", () => {
  it("reports the page it was given when that page exists", () => {
    const page = buildPage([1, 2], 20, 2, 2);
    expect(page).toEqual({ items: [1, 2], total: 20, page: 2, pageSize: 2, totalPages: 10 });
  });

  it("clamps a page beyond the end to the last page", () => {
    expect(buildPage([], 5, 99, 2).page).toBe(3);
  });

  it("clamps a page below one", () => {
    expect(buildPage([], 5, 0, 2).page).toBe(1);
  });

  it("reports one page when there are no results, so the UI never shows 'page 1 of 0'", () => {
    expect(buildPage([], 0, 1, 9)).toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 9,
      totalPages: 1,
    });
  });
});

describe("pageSkip", () => {
  it("is zero on the first page", () => {
    expect(pageSkip(1, 9)).toBe(0);
  });

  it("skips a full page per preceding page", () => {
    expect(pageSkip(3, 9)).toBe(18);
  });

  it("never returns a negative skip for a bad page number", () => {
    expect(pageSkip(0, 9)).toBe(0);
  });
});

describe("buildPage and pageSkip composed", () => {
  it("clamping the page before computing skip keeps the page and its rows in agreement", () => {
    const total = 15;
    const pageSize = 9;

    const clamped = buildPage([], total, 99, pageSize).page;
    expect(clamped).toBe(2);
    expect(pageSkip(clamped, pageSize)).toBe(9);
  });

  it("computing skip from the raw page instead lands past the end of the results", () => {
    // Documents the trap the contract exists to prevent: this skip returns no
    // rows for a 15-row catalog, yet buildPage would still report page 2 of 2.
    expect(pageSkip(99, 9)).toBe(882);
  });
});
