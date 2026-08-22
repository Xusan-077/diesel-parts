/**
 * Period arithmetic for the director dashboard.
 *
 * Pure and database-free, so the comparison window and the gap-filling can be
 * tested directly — the same split `product-where.ts` has from its repository.
 */

export interface Period {
  /** Inclusive start of the window being reported on. */
  from: Date;
  /** Exclusive end — "now", so today counts as a partial day. */
  to: Date;
  /** The equally long window immediately before `from`, for comparison. */
  previousFrom: Date;
  previousTo: Date;
  days: number;
}

export const PERIOD_OPTIONS = [7, 30, 90] as const;
export type PeriodDays = (typeof PERIOD_OPTIONS)[number];

/**
 * The analytics screen's own set, which starts at today.
 *
 * The dashboard deliberately does not offer a one-day window: it is the
 * at-a-glance screen and a single day of a parts wholesaler's trade is mostly
 * noise. The analytics screen is where someone goes to ask a specific question,
 * and "what happened today" is one of them.
 */
export const ANALYTICS_PERIOD_OPTIONS = [1, 7, 30, 90] as const;
export type AnalyticsPeriodDays = (typeof ANALYTICS_PERIOD_OPTIONS)[number];

export function isAnalyticsPeriodDays(value: unknown): value is AnalyticsPeriodDays {
  return ANALYTICS_PERIOD_OPTIONS.includes(Number(value) as AnalyticsPeriodDays);
}

export const DEFAULT_PERIOD_DAYS: PeriodDays = 30;

export function isPeriodDays(value: unknown): value is PeriodDays {
  return PERIOD_OPTIONS.includes(Number(value) as PeriodDays);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The window starts at midnight UTC so a day bucket always means a whole day.
 * `to` is the live clock, so the newest bucket is today-so-far.
 */
export function buildPeriod(days: number, now: Date = new Date()): Period {
  const startOfToday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const from = new Date(startOfToday.getTime() - (days - 1) * DAY_MS);
  const previousFrom = new Date(from.getTime() - days * DAY_MS);

  return { from, to: now, previousFrom, previousTo: from, days };
}

/** `YYYY-MM-DD` in UTC — the bucket key a day series is grouped by. */
export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export interface DayPoint {
  day: string;
  value: number;
}

/**
 * Turns sparse rows into one point per day across the whole window.
 *
 * A day with no orders has to appear as zero: dropping it would compress the
 * x-axis and draw a line straight over the quiet week, which reads as steady
 * trade rather than none.
 */
export function fillDays(
  from: Date,
  days: number,
  totals: ReadonlyMap<string, number>,
): DayPoint[] {
  const points: DayPoint[] = [];

  for (let index = 0; index < days; index += 1) {
    const day = dayKey(new Date(from.getTime() + index * DAY_MS));
    points.push({ day, value: totals.get(day) ?? 0 });
  }

  return points;
}

/**
 * Percentage change against the comparison window.
 *
 * Null when the previous window was empty: "up 100%" from nothing is a
 * meaningless number to put next to a currency figure.
 */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) {
    return null;
  }
  return ((current - previous) / previous) * 100;
}

/**
 * Running total across the window.
 *
 * Daily revenue for a parts wholesaler is mostly zeros with occasional spikes:
 * drawn as a line it implies trade on the quiet days, and one big order sets an
 * axis top that flattens everything else. The cumulative curve answers the
 * question the comparison is actually for — are we ahead of last period — and
 * the daily figures stay available in the chart's table view.
 */
export function cumulative(points: readonly DayPoint[]): DayPoint[] {
  let total = 0;
  return points.map((point) => {
    total += point.value;
    return { day: point.day, value: total };
  });
}

/** How wide a custom range may be, so one URL cannot ask for a decade of days. */
export const MAX_CUSTOM_DAYS = 366;

/**
 * A window the director picked by hand, as two `YYYY-MM-DD` strings.
 *
 * Returns null for anything that is not a usable range — an unparseable date,
 * an end before its start, or a span past `MAX_CUSTOM_DAYS`. The caller falls
 * back to the default window rather than rendering an error page: a mistyped
 * query string should show the dashboard, not break it.
 *
 * `to` is treated as inclusive, which is what a person means by "1–31 avgust".
 * Internally the window still ends on an exclusive bound, so the last day is
 * counted whole rather than up to midnight of its own morning.
 */
export function buildCustomPeriod(from: string, to: string): Period | null {
  const start = Date.parse(from + "T00:00:00.000Z");
  const endInclusive = Date.parse(to + "T00:00:00.000Z");

  if (Number.isNaN(start) || Number.isNaN(endInclusive) || endInclusive < start) {
    return null;
  }

  const days = Math.round((endInclusive - start) / DAY_MS) + 1;
  if (days > MAX_CUSTOM_DAYS) {
    return null;
  }

  const fromDate = new Date(start);
  const toDate = new Date(endInclusive + DAY_MS);
  const previousFrom = new Date(start - days * DAY_MS);

  return { from: fromDate, to: toDate, previousFrom, previousTo: fromDate, days };
}

/**
 * Resolves the window from the URL: a custom range when both ends parse, the
 * named day count otherwise.
 *
 * One function so every analytics query reads the same window from the same
 * params — the alternative is each section deciding for itself and a page whose
 * chart and table quietly disagree about which month they are describing.
 */
export function resolvePeriod(params: {
  days?: string;
  from?: string;
  to?: string;
}): { period: Period; custom: boolean } {
  if (params.from !== undefined && params.to !== undefined) {
    const custom = buildCustomPeriod(params.from, params.to);
    if (custom !== null) {
      return { period: custom, custom: true };
    }
  }

  const days = isAnalyticsPeriodDays(params.days)
    ? Number(params.days)
    : DEFAULT_PERIOD_DAYS;

  return { period: buildPeriod(days), custom: false };
}
