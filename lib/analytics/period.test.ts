import { describe, expect, it } from "vitest";
import { buildPeriod, cumulative, dayKey, fillDays, percentChange } from "./period";

const NOW = new Date("2026-08-18T14:30:00.000Z");

describe("buildPeriod", () => {
  it("starts the window at midnight so a bucket is a whole day", () => {
    const period = buildPeriod(7, NOW);
    expect(dayKey(period.from)).toBe("2026-08-12");
    expect(period.from.toISOString()).toBe("2026-08-12T00:00:00.000Z");
  });

  it("includes today, so a 7-day window spans 12th to 18th", () => {
    const period = buildPeriod(7, NOW);
    expect(period.to).toBe(NOW);
    expect(period.days).toBe(7);
  });

  it("puts the comparison window immediately before, with the same length", () => {
    const period = buildPeriod(7, NOW);
    expect(dayKey(period.previousFrom)).toBe("2026-08-05");
    expect(period.previousTo).toEqual(period.from);
  });

  it("leaves no gap or overlap between the two windows", () => {
    const period = buildPeriod(30, NOW);
    const span = period.previousTo.getTime() - period.previousFrom.getTime();
    expect(span).toBe(30 * 24 * 60 * 60 * 1000);
  });
});

describe("fillDays", () => {
  it("emits one point per day even where nothing was sold", () => {
    const points = fillDays(new Date("2026-08-16T00:00:00Z"), 3, new Map([["2026-08-17", 500]]));

    expect(points).toEqual([
      { day: "2026-08-16", value: 0 },
      { day: "2026-08-17", value: 500 },
      { day: "2026-08-18", value: 0 },
    ]);
  });

  it("returns nothing for a zero-day window", () => {
    expect(fillDays(new Date("2026-08-16T00:00:00Z"), 0, new Map())).toEqual([]);
  });
});

describe("percentChange", () => {
  it("reports a rise and a fall", () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 100)).toBe(-50);
  });

  it("is null when there is nothing to compare against", () => {
    expect(percentChange(100, 0)).toBeNull();
  });

  it("is zero when nothing changed", () => {
    expect(percentChange(100, 100)).toBe(0);
  });
});

describe("cumulative", () => {
  it("accumulates the running total", () => {
    expect(
      cumulative([
        { day: "a", value: 10 },
        { day: "b", value: 0 },
        { day: "c", value: 5 },
      ]),
    ).toEqual([
      { day: "a", value: 10 },
      { day: "b", value: 10 },
      { day: "c", value: 15 },
    ]);
  });

  it("never decreases, so the curve cannot mislead", () => {
    const points = cumulative([
      { day: "a", value: 3 },
      { day: "b", value: 0 },
      { day: "c", value: 7 },
    ]);
    for (let i = 1; i < points.length; i += 1) {
      expect(points[i].value).toBeGreaterThanOrEqual(points[i - 1].value);
    }
  });

  it("returns nothing for an empty window", () => {
    expect(cumulative([])).toEqual([]);
  });
});
