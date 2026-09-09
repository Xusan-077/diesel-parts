/**
 * Date formatting for the finance module.
 *
 * Money and plain integers have a panel-wide home in `lib/analytics/format.ts`
 * (`formatSum`, `formatInteger`) — use those. This carries only the date shapes
 * the finance tables need, in the fixed `dd.mm.yyyy` order the panel uses.
 *
 * Same hand-assembled, hydration-safe technique as `lib/warehouse/format.ts`
 * (see that file's note): `new Intl.DateTimeFormat("uz-UZ", …)` resolves
 * differently on the Next.js server runtime than in the browser because their
 * bundled ICU data differs, which trips a React hydration mismatch on every
 * row. `en-GB` is asked only for its numeric parts (Latin digits, present and
 * identical in every ICU build); the `.` / ` ` / `:` glue is ours, so the
 * string is byte-for-byte stable across runtimes. `Asia/Tashkent` is fixed
 * here too (UTC+5, no DST) so the wall clock never depends on the runtime's
 * own timezone. It is a separate copy rather than an import from the warehouse
 * module because module-scoped date formatting is the established pattern.
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

/** Today as `YYYY-MM-DD` in Tashkent — the default for a new expense's date. */
export function todayIsoDay(): string {
  const p = parts(dateFormatter, new Date());
  return `${p.year}-${p.month}-${p.day}`;
}
