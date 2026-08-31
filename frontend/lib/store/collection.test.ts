import { describe, expect, it } from "vitest";
import { addId, hasId, parseIdList, removeId, toggleId } from "./collection";

describe("addId", () => {
  it("appends a new id", () => {
    expect(addId(["a"], "b")).toEqual(["a", "b"]);
  });

  it("ignores a duplicate", () => {
    expect(addId(["a", "b"], "a")).toEqual(["a", "b"]);
  });

  it("refuses to grow past the maximum", () => {
    expect(addId(["a", "b"], "c", 2)).toEqual(["a", "b"]);
  });

  it("still allows a duplicate call at the maximum without dropping anything", () => {
    expect(addId(["a", "b"], "b", 2)).toEqual(["a", "b"]);
  });

  it("never mutates the input", () => {
    const input = ["a"];
    addId(input, "b");
    expect(input).toEqual(["a"]);
  });
});

describe("removeId", () => {
  it("removes the id", () => {
    expect(removeId(["a", "b"], "a")).toEqual(["b"]);
  });

  it("is a no-op for an absent id", () => {
    expect(removeId(["a"], "z")).toEqual(["a"]);
  });
});

describe("toggleId", () => {
  it("adds when absent and removes when present", () => {
    expect(toggleId([], "a")).toEqual(["a"]);
    expect(toggleId(["a"], "a")).toEqual([]);
  });

  it("respects the maximum when adding", () => {
    expect(toggleId(["a", "b"], "c", 2)).toEqual(["a", "b"]);
  });

  it("can always remove even at the maximum", () => {
    expect(toggleId(["a", "b"], "a", 2)).toEqual(["b"]);
  });
});

describe("hasId", () => {
  it("reports membership", () => {
    expect(hasId(["a"], "a")).toBe(true);
    expect(hasId(["a"], "b")).toBe(false);
  });
});

describe("parseIdList", () => {
  it("keeps valid string ids", () => {
    expect(parseIdList(["a", "b"])).toEqual(["a", "b"]);
  });

  it("drops duplicates, empty strings, and non-strings", () => {
    expect(parseIdList(["a", "a", "", 5, null, { id: "b" }])).toEqual(["a"]);
  });

  it("returns an empty list for anything that is not an array", () => {
    expect(parseIdList(null)).toEqual([]);
    expect(parseIdList("a,b")).toEqual([]);
    expect(parseIdList({ 0: "a" })).toEqual([]);
  });
});
