/**
 * Calendar arithmetic for the range picker.
 *
 * Pure and React-free, the same split `lib/analytics/period.ts` has from its
 * repository: month lengths, leap years and the Monday-first offset are the
 * parts of a calendar that break silently and are cheap to assert directly.
 *
 * Everything here speaks `YYYY-MM-DD` over UTC, never a local `Date` field.
 * That is load-bearing rather than fussy: `resolvePeriod` parses the URL's
 * bounds as `T00:00:00.000Z`, so a calendar that built its days from
 * `new Date(year, month, day)` would hand back days shifted by one either side
 * of midnight for anyone east or west of UTC — and the panel is used at UTC+5.
 */

const DAY_MS = 86_400_000;

export const MONTH_NAMES = [
  "Yanvar",
  "Fevral",
  "Mart",
  "Aprel",
  "May",
  "Iyun",
  "Iyul",
  "Avgust",
  "Sentabr",
  "Oktabr",
  "Noyabr",
  "Dekabr",
] as const;

/**
 * Monday first, and Sunday last so it can be drawn as the quiet column. That
 * is the week the warehouse actually runs on, and a director reading a Saturday
 * spike wants it beside the week it belongs to, not orphaned in column one.
 */
export const WEEKDAYS = [
  { short: "Du", long: "Dushanba" },
  { short: "Se", long: "Seshanba" },
  { short: "Ch", long: "Chorshanba" },
  { short: "Pa", long: "Payshanba" },
  { short: "Ju", long: "Juma" },
  { short: "Sh", long: "Shanba" },
  { short: "Ya", long: "Yakshanba" },
] as const;

/** An inclusive window, as the two days a person would name. */
export interface Range {
  start: string;
  end: string;
}

export interface Month {
  year: number;
  /** Zero-based, as `Date` counts them. */
  index: number;
}

/** `YYYY-MM-DD` in UTC — the format the URL and the period arithmetic share. */
export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseDay(iso: string): Date {
  return new Date(iso + "T00:00:00.000Z");
}

export function shiftDays(iso: string, days: number): string {
  return isoDay(new Date(parseDay(iso).getTime() + days * DAY_MS));
}

/** Inclusive length: a range from a day to itself is 1, not 0. */
export function spanDays(range: Range): number {
  return (
    Math.round(
      (parseDay(range.end).getTime() - parseDay(range.start).getTime()) / DAY_MS,
    ) + 1
  );
}

export function dayNumber(iso: string): number {
  return parseDay(iso).getUTCDate();
}

/** The column a day falls in, Monday = 0. */
export function weekdayIndex(iso: string): number {
  return (parseDay(iso).getUTCDay() + 6) % 7;
}

/** Puts two days in order, whichever way round they were picked. */
export function order(a: string, b: string): Range {
  return a <= b ? { start: a, end: b } : { start: b, end: a };
}

export function monthOf(iso: string): Month {
  const date = parseDay(iso);
  return { year: date.getUTCFullYear(), index: date.getUTCMonth() };
}

export function shiftMonth(month: Month, by: number): Month {
  const total = month.year * 12 + month.index + by;
  return { year: Math.floor(total / 12), index: ((total % 12) + 12) % 12 };
}

/** Months as one ordinal, so two of them can be compared or used as a key. */
export function monthKey(month: Month): number {
  return month.year * 12 + month.index;
}

export function monthLabel(month: Month): string {
  return MONTH_NAMES[month.index] + " " + month.year;
}

export function firstOfMonth(month: Month): string {
  return isoDay(new Date(Date.UTC(month.year, month.index, 1)));
}

export function lastOfMonth(month: Month): string {
  return isoDay(new Date(Date.UTC(month.year, month.index + 1, 0)));
}

/** "14 Iyul 2026" — what a screen reader announces for a day cell. */
export function fullDayLabel(iso: string): string {
  const date = parseDay(iso);
  return (
    date.getUTCDate() + " " + MONTH_NAMES[date.getUTCMonth()] + " " + date.getUTCFullYear()
  );
}

/**
 * Six weeks of cells, `null` where the month has not started or has ended.
 *
 * Always six rows, even for a February that fits in four. The alternative is a
 * popover that changes height as you page through months, which moves the
 * footer — and the Apply button — out from under the pointer.
 *
 * The neighbouring month's days are left blank rather than drawn in grey: two
 * months are on screen at once, so a greyed 1 August in the July panel is the
 * same day twice, half a grid apart, and the copy that is easier to hit is the
 * one that is not really there.
 */
export function monthCells(month: Month): (string | null)[] {
  const lead = weekdayIndex(firstOfMonth(month));
  const length = dayNumber(lastOfMonth(month));

  return Array.from({ length: 42 }, (_unused, cell) => {
    const day = cell - lead + 1;
    return day >= 1 && day <= length
      ? isoDay(new Date(Date.UTC(month.year, month.index, day)))
      : null;
  });
}

/**
 * The spans a wholesaler reports in.
 *
 * Deliberately not "last 7 / 30 / 90 days" — the analytics toolbar already has
 * those as presets, and repeating them in the calendar would make it a second
 * way to press the same button. These are the other kind of window: the ones
 * with a closing date, which is what someone opens a calendar for.
 *
 * Each is measured from `max`, the latest reportable day, so none of them can
 * run past the data.
 */
export const QUICK_SPANS: readonly { label: string; of: (max: string) => Range }[] = [
  {
    label: "Shu oy",
    of: (max) => ({ start: firstOfMonth(monthOf(max)), end: max }),
  },
  {
    label: "O'tgan oy",
    of: (max) => {
      const previous = shiftMonth(monthOf(max), -1);
      return { start: firstOfMonth(previous), end: lastOfMonth(previous) };
    },
  },
  {
    label: "Shu chorak",
    of: (max) => {
      const month = monthOf(max);
      return {
        start: firstOfMonth({ year: month.year, index: Math.floor(month.index / 3) * 3 }),
        end: max,
      };
    },
  },
  {
    label: "Shu yil",
    of: (max) => ({
      start: firstOfMonth({ year: monthOf(max).year, index: 0 }),
      end: max,
    }),
  },
];
