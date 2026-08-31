import { describe, expect, it } from "vitest";
import {
  isSuggestible,
  moveActive,
  MIN_QUERY_LENGTH,
  NO_SUGGESTION,
  productHref,
  searchResultsHref,
} from "./search-suggest";

describe("isSuggestible", () => {
  it("stays quiet until there is something to match on", () => {
    expect(isSuggestible("")).toBe(false);
    expect(isSuggestible("f")).toBe(false);
    expect(isSuggestible("fo")).toBe(true);
  });

  it("does not count whitespace as typing", () => {
    expect(isSuggestible("   ")).toBe(false);
    expect(isSuggestible(" f ")).toBe(false);
    expect(isSuggestible(" fo ")).toBe(true);
  });

  it("agrees with the minimum it publishes", () => {
    expect(isSuggestible("x".repeat(MIN_QUERY_LENGTH))).toBe(true);
    expect(isSuggestible("x".repeat(MIN_QUERY_LENGTH - 1))).toBe(false);
  });
});

describe("moveActive", () => {
  it("enters the list from the top going down", () => {
    expect(moveActive(NO_SUGGESTION, 6, 1)).toBe(0);
  });

  it("enters the list from the bottom going up", () => {
    expect(moveActive(NO_SUGGESTION, 6, -1)).toBe(5);
  });

  it("walks the list", () => {
    expect(moveActive(0, 6, 1)).toBe(1);
    expect(moveActive(3, 6, -1)).toBe(2);
  });

  it("returns to what was typed rather than wrapping past it", () => {
    // The whole point: the query is recoverable from either end.
    expect(moveActive(5, 6, 1)).toBe(NO_SUGGESTION);
    expect(moveActive(0, 6, -1)).toBe(NO_SUGGESTION);
  });

  it("has nowhere to go with no suggestions", () => {
    expect(moveActive(NO_SUGGESTION, 0, 1)).toBe(NO_SUGGESTION);
    expect(moveActive(NO_SUGGESTION, 0, -1)).toBe(NO_SUGGESTION);
  });

  it("visits every position exactly once on the way round", () => {
    const seen: number[] = [];
    let active = NO_SUGGESTION;
    for (let step = 0; step < 4; step += 1) {
      active = moveActive(active, 3, 1);
      seen.push(active);
    }
    expect(seen).toEqual([0, 1, 2, NO_SUGGESTION]);
  });
});

describe("hrefs", () => {
  it("sends a query to the catalog, which owns the filters", () => {
    expect(searchResultsHref("CAT 950")).toBe("/products?q=CAT%20950");
  });

  it("sends an empty query to the unfiltered catalog", () => {
    expect(searchResultsHref("   ")).toBe("/products");
  });

  it("escapes what would otherwise be another parameter", () => {
    expect(searchResultsHref("a&b=c")).toBe("/products?q=a%26b%3Dc");
  });

  it("addresses a product by slug", () => {
    expect(productHref("cat-950-filter")).toBe("/products/cat-950-filter");
  });
});
