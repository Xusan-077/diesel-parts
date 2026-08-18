/**
 * Number formatting for the panel.
 *
 * Separate from `lib/format-price.ts`, which formats a customer-facing price in
 * three locales. The panel is Uzbek-only and its figures are sums in the tens of
 * millions, where a full grouped number is unreadable on a chart axis.
 */

const GROUP = " ";

export function formatInteger(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, GROUP);
}

/** Full sum with the currency word — for hero figures and table cells. */
export function formatSum(value: number): string {
  return `${formatInteger(value)} so'm`;
}

/**
 * Short form for axis ticks and dense cells: 12 400 000 becomes "12,4 mln".
 * The comma is the Uzbek decimal separator.
 */
export function formatCompact(value: number): string {
  const abs = Math.abs(value);

  if (abs >= 1_000_000_000) {
    return `${trim(value / 1_000_000_000)} mlrd`;
  }
  if (abs >= 1_000_000) {
    return `${trim(value / 1_000_000)} mln`;
  }
  if (abs >= 1_000) {
    return `${trim(value / 1_000)} ming`;
  }
  return formatInteger(value);
}

function trim(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded)
    ? String(rounded)
    : String(rounded).replace(".", ",");
}

/** Signed percentage for a period-over-period delta. */
export function formatDelta(change: number | null): string | null {
  if (change === null) {
    return null;
  }
  const rounded = Math.round(change * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${String(rounded).replace(".", ",")}%`;
}

/** `2026-08-18` rendered as `18 avg` for a chart axis. */
const MONTHS_SHORT = [
  "yan", "fev", "mar", "apr", "may", "iyn",
  "iyl", "avg", "sen", "okt", "noy", "dek",
];

export function formatDayLabel(day: string): string {
  const [, month, date] = day.split("-");
  return `${Number(date)} ${MONTHS_SHORT[Number(month) - 1]}`;
}
