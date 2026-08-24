import { describe, expect, it } from "vitest";
import { addSearchTerm, MAX_SEARCH_HISTORY, parseSearchHistory } from "./search-history";

describe("addSearchTerm", () => {
  it("adds a new term to the front", () => {
    expect(addSearchTerm(["a"], "b")).toEqual(["b", "a"]);
  });

  it("trims the term before storing it", () => {
    expect(addSearchTerm([], "  CAT 950  ")).toEqual(["CAT 950"]);
  });

  it("ignores a blank or whitespace-only term", () => {
    expect(addSearchTerm(["a"], "   ")).toEqual(["a"]);
  });

  it("moves a case-insensitive repeat to the front instead of duplicating it", () => {
    expect(addSearchTerm(["cat", "b"], "CAT")).toEqual(["CAT", "b"]);
  });

  it("caps the list at the maximum, dropping the oldest", () => {
    const full = Array.from({ length: MAX_SEARCH_HISTORY }, (_, i) => `term-${i}`);
    const result = addSearchTerm(full, "newest");
    expect(result).toHaveLength(MAX_SEARCH_HISTORY);
    expect(result[0]).toBe("newest");
    expect(result).not.toContain(`term-${MAX_SEARCH_HISTORY - 1}`);
  });

  it("never mutates the input", () => {
    const input = ["a"];
    addSearchTerm(input, "b");
    expect(input).toEqual(["a"]);
  });
});

describe("parseSearchHistory", () => {
  it("keeps valid string terms", () => {
    expect(parseSearchHistory(["a", "b"])).toEqual(["a", "b"]);
  });

  it("drops case-insensitive duplicates, blanks, and non-strings", () => {
    expect(parseSearchHistory(["cat", "CAT", "  ", 5, null, { term: "b" }])).toEqual(["cat"]);
  });

  it("trims each entry", () => {
    expect(parseSearchHistory(["  cat  "])).toEqual(["cat"]);
  });

  it("caps the result at the maximum", () => {
    const raw = Array.from({ length: MAX_SEARCH_HISTORY + 5 }, (_, i) => `term-${i}`);
    expect(parseSearchHistory(raw)).toHaveLength(MAX_SEARCH_HISTORY);
  });

  it("returns an empty list for anything that is not an array", () => {
    expect(parseSearchHistory(null)).toEqual([]);
    expect(parseSearchHistory("a,b")).toEqual([]);
    expect(parseSearchHistory({ 0: "a" })).toEqual([]);
  });
});
