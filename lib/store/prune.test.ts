import { describe, expect, it } from "vitest";
import { canPrune, missingIds } from "./prune";

describe("missingIds", () => {
  it("finds nothing when everything resolved", () => {
    expect(missingIds(["a", "b"], ["a", "b"])).toEqual([]);
  });

  it("reports the ids the catalog did not answer for", () => {
    expect(missingIds(["a", "b", "c"], ["c", "a"])).toEqual(["b"]);
  });

  it("ignores extra ids the catalog volunteered", () => {
    expect(missingIds(["a"], ["a", "z"])).toEqual([]);
  });

  it("reports everything when nothing resolved", () => {
    expect(missingIds(["a", "b"], [])).toEqual(["a", "b"]);
  });
});

describe("canPrune", () => {
  it("allows a successful read of a list within the cap", () => {
    expect(canPrune(3, 60, true)).toBe(true);
  });

  it("refuses a read that has not succeeded", () => {
    expect(canPrune(3, 60, false)).toBe(false);
  });

  it("refuses a list longer than the endpoint's cap", () => {
    expect(canPrune(61, 60, true)).toBe(false);
  });

  it("allows a list exactly at the cap", () => {
    expect(canPrune(60, 60, true)).toBe(true);
  });

  it("refuses an empty list, which resolves without a request", () => {
    expect(canPrune(0, 60, true)).toBe(false);
  });
});
