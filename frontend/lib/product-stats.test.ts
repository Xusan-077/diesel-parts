import { describe, expect, it } from "vitest";
import { averageRating, formatCount, starFill } from "./product-stats";

describe("averageRating", () => {
  it("returns null when nothing has been rated", () => {
    expect(averageRating([])).toBeNull();
  });

  it("averages whole stars", () => {
    expect(averageRating([5, 4, 3])).toBe(4);
  });

  it("rounds to one decimal", () => {
    expect(averageRating([5, 4, 4])).toBe(4.3);
    expect(averageRating([5, 5, 4])).toBe(4.7);
  });

  it("drops ratings outside the one-to-five range", () => {
    expect(averageRating([5, 0, 9, 3])).toBe(4);
  });

  it("returns null rather than zero when every rating was invalid", () => {
    expect(averageRating([0, 7, Number.NaN])).toBeNull();
  });

  it("keeps a genuine one-star average", () => {
    expect(averageRating([1, 1])).toBe(1);
  });
});

describe("starFill", () => {
  it("leaves every star empty for an unrated product", () => {
    expect(starFill(null)).toEqual({ full: 0, half: false, empty: 5 });
  });

  it("fills whole stars exactly", () => {
    expect(starFill(4)).toEqual({ full: 4, half: false, empty: 1 });
  });

  it("rounds to the nearest half", () => {
    // 4.2 is nearer four stars, 4.6 is nearer four and a half.
    expect(starFill(4.2)).toEqual({ full: 4, half: false, empty: 1 });
    expect(starFill(4.6)).toEqual({ full: 4, half: true, empty: 0 });
    expect(starFill(4.8)).toEqual({ full: 5, half: false, empty: 0 });
  });

  it("cannot separate two ratings inside the same half-star", () => {
    // Half stars are the resolution on offer: 4.3 and 4.7 both round to 4.5.
    // The numeral beside the row is what tells them apart.
    expect(starFill(4.3)).toEqual(starFill(4.7));
  });

  it("always accounts for exactly five stars", () => {
    for (const rating of [0, 0.2, 1.5, 2.4, 3.8, 5]) {
      const { full, half, empty } = starFill(rating);
      expect(full + (half ? 1 : 0) + empty).toBe(5);
    }
  });

  it("clamps a rating outside the scale", () => {
    expect(starFill(9)).toEqual({ full: 5, half: false, empty: 0 });
    expect(starFill(-2)).toEqual({ full: 0, half: false, empty: 5 });
  });
});

describe("formatCount", () => {
  it("groups thousands so a count does not read as a part number", () => {
    expect(formatCount(1240, "en")).toBe("1,240");
    expect(formatCount(1240, "uz").replace(/\u00a0/g, " ")).toBe("1 240");
  });

  it("leaves small counts alone", () => {
    expect(formatCount(7, "uz")).toBe("7");
  });

  it("floors a negative or fractional count to something printable", () => {
    expect(formatCount(-5, "uz")).toBe("0");
    expect(formatCount(3.9, "uz")).toBe("3");
  });
});
