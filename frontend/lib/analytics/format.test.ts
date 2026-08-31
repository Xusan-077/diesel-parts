import { describe, expect, it } from "vitest";
import { formatCompact, formatDayLabel, formatDelta, formatSum } from "./format";

describe("formatCompact", () => {
  it("shortens millions and billions", () => {
    expect(formatCompact(12_400_000)).toBe("12,4 mln");
    expect(formatCompact(1_000_000)).toBe("1 mln");
    expect(formatCompact(2_500_000_000)).toBe("2,5 mlrd");
  });

  it("shortens thousands", () => {
    expect(formatCompact(4_500)).toBe("4,5 ming");
  });

  it("leaves small numbers grouped but whole", () => {
    expect(formatCompact(0)).toBe("0");
    expect(formatCompact(999)).toBe("999");
  });
});

describe("formatSum", () => {
  it("groups with spaces and names the currency", () => {
    expect(formatSum(12_400_000)).toBe("12 400 000 so'm");
  });
});

describe("formatDelta", () => {
  it("signs a rise and leaves a fall with its minus", () => {
    expect(formatDelta(12.34)).toBe("+12,3%");
    expect(formatDelta(-8)).toBe("-8%");
  });

  it("is null when there is nothing to compare against", () => {
    expect(formatDelta(null)).toBeNull();
  });
});

describe("formatDayLabel", () => {
  it("renders a day key as a short Uzbek date", () => {
    expect(formatDayLabel("2026-08-18")).toBe("18 avg");
    expect(formatDayLabel("2026-01-01")).toBe("1 yan");
  });
});
