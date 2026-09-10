/**
 * Finance filters come in as `YYYY-MM-DD` calendar days and mean a wall-clock
 * day in Tashkent (UTC+5, no DST) — the panel's fixed timezone. A day range is
 * half-open: `gte` the start of `dateFrom`, `lt` the start of the day after
 * `dateTo`, so the whole of `dateTo` is included without a millisecond gap.
 */

const TASHKENT_OFFSET = '+05:00';
const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight of `day` (a `YYYY-MM-DD` string) in Tashkent, as a UTC `Date`. */
export function tashkentDayStart(day: string): Date {
  return new Date(`${day}T00:00:00.000${TASHKENT_OFFSET}`);
}

export interface DateRange {
  gte?: Date;
  lt?: Date;
}

/** `{ gte?, lt? }` for a Prisma `where` — omit a bound when its day is absent. */
export function tashkentDayRange(
  dateFrom?: string,
  dateTo?: string,
): DateRange {
  const range: DateRange = {};
  if (dateFrom) range.gte = tashkentDayStart(dateFrom);
  if (dateTo) range.lt = new Date(tashkentDayStart(dateTo).getTime() + DAY_MS);
  return range;
}

/** True when the range has at least one bound (worth adding to a `where`). */
export function hasBound(range: DateRange): boolean {
  return range.gte !== undefined || range.lt !== undefined;
}
