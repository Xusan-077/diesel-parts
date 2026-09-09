/**
 * Date formatting for the warehouse module.
 *
 * Money and plain integers already have a panel-wide home in
 * `lib/analytics/format.ts` (`formatSum`, `formatInteger`, `formatCompact`) —
 * use those. This adds only the two date shapes the ledger and receipt tables
 * need, in the same fixed `dd.mm.yyyy` order the rest of the panel uses rather
 * than a locale-dependent one.
 */

const dateFormatter = new Intl.DateTimeFormat("uz-UZ", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("uz-UZ", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(value: string | Date): string {
  return dateFormatter.format(new Date(value));
}

export function formatDateTime(value: string | Date): string {
  return dateTimeFormatter.format(new Date(value));
}
