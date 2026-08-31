/**
 * The human-readable reference quoted to a customer: `DP-2026-0042`.
 *
 * Pure. The repository reads the highest number already issued for the year,
 * calls this, and inserts; `Order.orderNumber` is `@unique`, so two sellers
 * saving at the same moment produce a write error the repository retries,
 * never a duplicate reference.
 */

const PREFIX = "DP";
const SEQUENCE_DIGITS = 4;

/** Anything not of the form `DP-<year>-<digits>` is treated as absent. */
const ORDER_NUMBER = /^DP-(\d{4})-(\d+)$/;

export function parseOrderNumber(value: string): { year: number; sequence: number } | null {
  const match = ORDER_NUMBER.exec(value);
  if (match === null) {
    return null;
  }
  return { year: Number(match[1]), sequence: Number(match[2]) };
}

export function formatOrderNumber(year: number, sequence: number): string {
  return `${PREFIX}-${year}-${String(sequence).padStart(SEQUENCE_DIGITS, "0")}`;
}

/**
 * The next reference for `year`, given the highest one issued so far.
 *
 * The sequence restarts at each new year, so `latest` is ignored unless it
 * belongs to the year being issued. A malformed or absent latest value starts
 * the year rather than failing: a reference is a label, and refusing to write
 * an order because an old one was hand-edited would be the worse outcome.
 */
export function nextOrderNumber(latest: string | null, year: number): string {
  const parsed = latest === null ? null : parseOrderNumber(latest);
  const sequence = parsed !== null && parsed.year === year ? parsed.sequence + 1 : 1;
  return formatOrderNumber(year, sequence);
}
