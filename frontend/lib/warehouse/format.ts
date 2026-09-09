/**
 * Date formatting for the warehouse module.
 *
 * Money and plain integers already have a panel-wide home in
 * `lib/analytics/format.ts` (`formatSum`, `formatInteger`, `formatCompact`) —
 * use those. This adds only the two date shapes the ledger and receipt tables
 * need, in the same fixed `dd.mm.yyyy` order the rest of the panel uses rather
 * than a locale-dependent one.
 *
 * The order AND the separators are assembled by hand from
 * `Intl.DateTimeFormat.formatToParts`, not taken from a locale's own pattern:
 * `new Intl.DateTimeFormat("uz-UZ", …)` resolves to different output on the
 * Next.js server runtime (`2026-09-09 16:11`) than in the browser
 * (`09/09/2026, 16:11`) because their bundled ICU data for `uz-UZ` differs —
 * which rendered these dates once on the server and again, differently, on the
 * client, tripping a React hydration mismatch on every receipt / movement row.
 * `en-GB` is asked only for its numeric parts (Latin digits, `2-digit` /
 * `numeric` — present and identical in every ICU build, full or small); the
 * `.` / ` ` / `:` glue is ours, so the string is byte-for-byte stable across
 * runtimes. `Asia/Tashkent` is fixed here too (UTC+5, no DST) so the wall
 * clock does not depend on the server's or the viewer's own timezone.
 */

const TASHKENT = "Asia/Tashkent";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: TASHKENT,
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: TASHKENT,
});

function parts(formatter: Intl.DateTimeFormat, value: string | Date): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of formatter.formatToParts(new Date(value))) {
    if (part.type !== "literal") {
      out[part.type] = part.value;
    }
  }
  return out;
}

export function formatDate(value: string | Date): string {
  const p = parts(dateFormatter, value);
  return `${p.day}.${p.month}.${p.year}`;
}

export function formatDateTime(value: string | Date): string {
  const p = parts(dateTimeFormatter, value);
  // `hour12: false` can surface midnight as "24" in some ICU builds — normalise.
  const hour = p.hour === "24" ? "00" : p.hour;
  return `${p.day}.${p.month}.${p.year} ${hour}:${p.minute}`;
}
