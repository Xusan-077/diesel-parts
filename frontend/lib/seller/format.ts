/**
 * Formatting helpers for the seller panel.
 *
 * The two date functions assemble their `dd.mm.yyyy` / `dd.mm.yyyy HH:mm`
 * output by hand from `Intl.DateTimeFormat.formatToParts`, NOT from a
 * locale's own pattern. `new Intl.DateTimeFormat("uz-UZ", …)` resolves to
 * different output on the Next.js server runtime than in the browser — their
 * bundled ICU data for `uz-UZ` disagree (`2026-09-09 16:11` vs
 * `09/09/2026, 16:11`) — so a Client Component that renders a date on the
 * server and again on the client (the notifications menu, the orders table)
 * tripped a React hydration mismatch. `en-GB` is asked only for its numeric
 * parts (Latin digits, `2-digit` / `numeric` — identical in every ICU build);
 * the `.` / ` ` / `:` glue is ours, so the string is byte-for-byte stable
 * across runtimes. `Asia/Tashkent` (UTC+5, no DST) is fixed here too so the
 * wall clock does not depend on the server's or the viewer's timezone. Same
 * fix as `lib/warehouse/format.ts` — kept self-contained per module, matching
 * how the two panels' formatters are already split.
 */

const moneyFormatter = new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 0 });

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

function parts(formatter: Intl.DateTimeFormat, value: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of formatter.formatToParts(new Date(value))) {
    if (part.type !== "literal") {
      out[part.type] = part.value;
    }
  }
  return out;
}

/** Decimal columns arrive as strings over JSON (Prisma Decimal). */
export function formatMoney(value: string | number): string {
  const numeric = typeof value === "string" ? Number(value) : value;
  return `${moneyFormatter.format(Number.isFinite(numeric) ? numeric : 0)} so'm`;
}

export function formatDate(value: string): string {
  const p = parts(dateFormatter, value);
  return `${p.day}.${p.month}.${p.year}`;
}

export function formatDateTime(value: string): string {
  const p = parts(dateTimeFormatter, value);
  // `hour12: false` can surface midnight as "24" in some ICU builds — normalise.
  const hour = p.hour === "24" ? "00" : p.hour;
  return `${p.day}.${p.month}.${p.year} ${hour}:${p.minute}`;
}

export function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}
