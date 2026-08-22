import { describe, expect, it } from "vitest";
import {
  COUNT_UP_MS,
  easeOutCubic,
  groupWith,
  splitLeadingNumber,
  valueAt,
} from "./count-up";

describe("splitLeadingNumber", () => {
  it("reads a plain figure and what follows it", () => {
    expect(splitLeadingNumber("30+ yil tajriba")).toMatchObject({
      value: 15,
      text: "15",
      rest: "+ yil tajriba",
      separator: "",
    });
  });

  it("keeps the grouping the copy was written with", () => {
    expect(splitLeadingNumber("10,000+ mahsulot")).toMatchObject({
      value: 10_000,
      text: "10,000",
      rest: "+ mahsulot",
      separator: ",",
    });
  });

  it("reads a figure grouped with spaces", () => {
    expect(splitLeadingNumber("10 000+ artikul")).toMatchObject({
      value: 10_000,
      separator: " ",
    });
  });

  it("has nothing to count in copy with no figure", () => {
    expect(splitLeadingNumber("OEM sifat")).toBeNull();
    expect(splitLeadingNumber("Jahon bo'ylab yetkazib berish")).toBeNull();
  });

  it("ignores a number in the middle of a sentence", () => {
    // Prose, not a statistic. Animating it would animate the sentence.
    expect(splitLeadingNumber("Kafolat 12 oy")).toBeNull();
  });

  it("tolerates the whitespace a translator leaves behind", () => {
    expect(splitLeadingNumber("  30+ yil  ")).toMatchObject({ value: 15 });
  });
});

describe("groupWith", () => {
  it("groups with the separator it was given", () => {
    expect(groupWith(10_000, ",")).toBe("10,000");
    expect(groupWith(10_000, " ")).toBe("10 000");
  });

  it("leaves an ungrouped figure alone", () => {
    expect(groupWith(15, "")).toBe("15");
    expect(groupWith(999, ",")).toBe("999");
  });

  it("never shows a negative", () => {
    expect(groupWith(-5, "")).toBe("0");
  });

  it("puts back exactly what was read", () => {
    const read = splitLeadingNumber("10,000+ mahsulot")!;
    expect(groupWith(read.value, read.separator)).toBe(read.text);
  });
});

describe("easeOutCubic", () => {
  it("runs from nothing to everything", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
  });

  it("is past halfway at the halfway point", () => {
    // The shape of a figure arriving, not of a bar loading.
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });

  it("clamps rather than overshooting", () => {
    expect(easeOutCubic(-1)).toBe(0);
    expect(easeOutCubic(2)).toBe(1);
  });
});

describe("valueAt", () => {
  it("starts at nothing and lands exactly on the target", () => {
    expect(valueAt(0, 10_000)).toBe(0);
    expect(valueAt(COUNT_UP_MS, 10_000)).toBe(10_000);
  });

  it("never overshoots or goes backwards", () => {
    let previous = 0;
    for (let t = 0; t <= COUNT_UP_MS; t += 50) {
      const value = valueAt(t, 15);
      expect(value).toBeGreaterThanOrEqual(previous);
      expect(value).toBeLessThanOrEqual(15);
      previous = value;
    }
  });

  it("moves off zero on the very first frame", () => {
    // The reason for rounding up: a small target counting from a visible 0 for
    // a third of a second reads as broken rather than as arriving.
    expect(valueAt(16, 15)).toBeGreaterThan(0);
    expect(valueAt(16, 10_000)).toBeGreaterThan(0);
  });

  it("settles early on a small target, and that is the accepted trade", () => {
    // The ceiling reaches 15 before the easing does. A large figure, which is
    // what a counter is for, still runs the whole way.
    expect(valueAt(COUNT_UP_MS * 0.6, 15)).toBe(15);
    expect(valueAt(COUNT_UP_MS * 0.6, 10_000)).toBeLessThan(10_000);
  });

  it("is the target immediately when there is no duration to run", () => {
    expect(valueAt(0, 15, 0)).toBe(15);
  });
});
