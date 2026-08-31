import { describe, expect, it } from "vitest";
import {
  QUICK_SPANS,
  dayNumber,
  firstOfMonth,
  fullDayLabel,
  isoDay,
  lastOfMonth,
  monthCells,
  monthKey,
  monthLabel,
  monthOf,
  order,
  shiftDays,
  shiftMonth,
  spanDays,
  weekdayIndex,
} from "./calendar";

/** The spans, keyed by the label the calendar prints on them. */
function quickSpan(label: string, max: string) {
  const span = QUICK_SPANS.find((entry) => entry.label === label);
  if (span === undefined) {
    throw new Error("no quick span named " + label);
  }
  return span.of(max);
}

describe("day arithmetic", () => {
  it("stays on the same day whatever the machine's timezone is", () => {
    /*
     * The trap this module exists to avoid: `new Date("2026-08-22")` is UTC
     * midnight, and reading it back through a *local* getter west of Greenwich
     * returns the 21st. Every read here is a UTC read, so the round trip holds.
     */
    expect(isoDay(new Date("2026-08-22T00:00:00.000Z"))).toBe("2026-08-22");
    expect(dayNumber("2026-08-22")).toBe(22);
  });

  it("counts an inclusive span, so a day against itself is one day", () => {
    expect(spanDays({ start: "2026-08-22", end: "2026-08-22" })).toBe(1);
    expect(spanDays({ start: "2026-08-01", end: "2026-08-22" })).toBe(22);
  });

  it("counts the leap day when the window contains one", () => {
    expect(spanDays({ start: "2024-02-01", end: "2024-03-01" })).toBe(30);
    expect(spanDays({ start: "2026-02-01", end: "2026-03-01" })).toBe(29);
  });

  it("steps across month and year boundaries", () => {
    expect(shiftDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(shiftDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftDays("2024-02-28", 1)).toBe("2024-02-29");
  });

  it("puts two days in order whichever way round they were picked", () => {
    expect(order("2026-08-22", "2026-07-14")).toEqual({
      start: "2026-07-14",
      end: "2026-08-22",
    });
    expect(order("2026-07-14", "2026-08-22")).toEqual({
      start: "2026-07-14",
      end: "2026-08-22",
    });
  });
});

describe("weekdayIndex", () => {
  it("counts from Monday, not from Sunday", () => {
    // 2025-12-01 is a Monday and 2026-02-01 a Sunday.
    expect(weekdayIndex("2025-12-01")).toBe(0);
    expect(weekdayIndex("2026-02-01")).toBe(6);
  });
});

describe("months", () => {
  it("wraps the year in both directions", () => {
    expect(shiftMonth({ year: 2026, index: 11 }, 1)).toEqual({ year: 2027, index: 0 });
    expect(shiftMonth({ year: 2026, index: 0 }, -1)).toEqual({ year: 2025, index: 11 });
    expect(shiftMonth({ year: 2026, index: 5 }, -12)).toEqual({ year: 2025, index: 5 });
  });

  it("orders as one number, so two months can be compared", () => {
    expect(monthKey({ year: 2026, index: 0 })).toBeGreaterThan(
      monthKey({ year: 2025, index: 11 }),
    );
  });

  it("knows how long each month is", () => {
    expect(lastOfMonth({ year: 2024, index: 1 })).toBe("2024-02-29");
    expect(lastOfMonth({ year: 2026, index: 1 })).toBe("2026-02-28");
    expect(lastOfMonth({ year: 2026, index: 3 })).toBe("2026-04-30");
    expect(firstOfMonth({ year: 2026, index: 7 })).toBe("2026-08-01");
  });

  it("names months in Uzbek", () => {
    expect(monthLabel(monthOf("2026-08-22"))).toBe("Avgust 2026");
    expect(fullDayLabel("2026-08-22")).toBe("22 Avgust 2026");
  });
});

describe("monthCells", () => {
  it("always returns six weeks, so the popover cannot change height", () => {
    for (const month of [0, 1, 6, 11]) {
      expect(monthCells({ year: 2026, index: month })).toHaveLength(42);
    }
  });

  it("offsets the first day into its Monday-first column", () => {
    // 2026-08-01 is a Saturday: five blanks, then the 1st.
    const august = monthCells({ year: 2026, index: 7 });
    expect(august.slice(0, 5)).toEqual([null, null, null, null, null]);
    expect(august[5]).toBe("2026-08-01");
  });

  it("fills a whole month and nothing beyond it", () => {
    const february = monthCells({ year: 2024, index: 1 });
    const days = february.filter((day) => day !== null);

    expect(days).toHaveLength(29);
    expect(days[0]).toBe("2024-02-01");
    expect(days.at(-1)).toBe("2024-02-29");
    // No neighbouring month leaks in — those cells are blank on purpose, so
    // the same day cannot be clicked in two panels at once.
    expect(days.every((day) => day.startsWith("2024-02"))).toBe(true);
  });

  it("keeps every day in its own weekday column", () => {
    const cells = monthCells({ year: 2026, index: 1 });

    cells.forEach((day, cell) => {
      if (day !== null) {
        expect(weekdayIndex(day)).toBe(cell % 7);
      }
    });
  });
});

describe("quick spans", () => {
  // A Saturday in the third quarter, so every span has something to prove.
  const max = "2026-08-22";

  it("runs the current month up to the last reportable day, not to its end", () => {
    expect(quickSpan("Shu oy", max)).toEqual({ start: "2026-08-01", end: max });
  });

  it("takes the previous month whole", () => {
    expect(quickSpan("O'tgan oy", max)).toEqual({
      start: "2026-07-01",
      end: "2026-07-31",
    });
  });

  it("crosses the year boundary when the previous month is December", () => {
    expect(quickSpan("O'tgan oy", "2026-01-15")).toEqual({
      start: "2025-12-01",
      end: "2025-12-31",
    });
  });

  it("starts the quarter at its own first month", () => {
    expect(quickSpan("Shu chorak", max).start).toBe("2026-07-01");
    expect(quickSpan("Shu chorak", "2026-03-09").start).toBe("2026-01-01");
    expect(quickSpan("Shu chorak", "2026-12-31").start).toBe("2026-10-01");
  });

  it("starts the year on 1 January", () => {
    expect(quickSpan("Shu yil", max)).toEqual({ start: "2026-01-01", end: max });
  });

  it("never offers a window the report would refuse", () => {
    // MAX_CUSTOM_DAYS is 366; the widest span here is a full leap year.
    for (const day of ["2024-12-31", "2026-08-22", "2026-01-01"]) {
      for (const span of QUICK_SPANS) {
        const range = span.of(day);
        expect(range.start <= range.end, span.label + " on " + day).toBe(true);
        expect(range.end <= day, span.label + " on " + day).toBe(true);
        expect(spanDays(range), span.label + " on " + day).toBeLessThanOrEqual(366);
      }
    }
  });
});
