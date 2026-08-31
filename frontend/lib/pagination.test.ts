import { describe, expect, it } from "vitest";
import { getPageItems } from "./pagination";

describe("getPageItems", () => {
  it("returns nothing when there are no pages", () => {
    expect(getPageItems(1, 0)).toEqual([]);
  });

  it("lists every page with no gaps when they all fit", () => {
    expect(getPageItems(1, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("gaps only on the right near the start", () => {
    expect(getPageItems(1, 10)).toEqual([1, 2, 3, 4, 5, "ellipsis", 10]);
  });

  it("gaps only on the left near the end", () => {
    expect(getPageItems(10, 10)).toEqual([1, "ellipsis", 6, 7, 8, 9, 10]);
  });

  it("gaps on both sides in the middle", () => {
    expect(getPageItems(5, 10)).toEqual([1, "ellipsis", 4, 5, 6, "ellipsis", 10]);
  });

  it("keeps a constant slot count while paging through", () => {
    const widths = new Set(
      Array.from({ length: 20 }, (_, i) => getPageItems(i + 1, 20).length)
    );
    expect(widths).toEqual(new Set([7]));
  });

  it("never emits a gap that hides a single page", () => {
    for (let current = 1; current <= 12; current += 1) {
      const items = getPageItems(current, 12);
      for (let i = 1; i < items.length; i += 1) {
        if (items[i] === "ellipsis") {
          const before = items[i - 1] as number;
          const after = items[i + 1] as number;
          expect(after - before).toBeGreaterThan(2);
        }
      }
    }
  });

  it("clamps a current page outside the range", () => {
    expect(getPageItems(99, 10)).toEqual(getPageItems(10, 10));
    expect(getPageItems(-3, 10)).toEqual(getPageItems(1, 10));
  });

  it("widens the window with more siblings", () => {
    expect(getPageItems(10, 20, 2)).toEqual([1, "ellipsis", 8, 9, 10, 11, 12, "ellipsis", 20]);
  });
});
