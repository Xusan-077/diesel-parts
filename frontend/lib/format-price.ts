import type { Locale } from "@/lib/i18n/locales";

export const CURRENCY = "UZS";

/**
 * Grouping is done by hand rather than through `Intl.NumberFormat`: ICU data
 * differs between Node and browsers (Chrome renders `uz-UZ` with commas, Node
 * with spaces), which would make both the output and its tests depend on where
 * the code runs. Uzbek and Russian group with a space, English with a comma.
 */
const GROUP_SEPARATOR: Record<Locale, string> = {
  uz: " ",
  ru: " ",
  en: ",",
};

/** Suffix appended after the amount; English keeps the ISO code up front. */
const SUFFIX: Record<Locale, string> = {
  uz: "so'm",
  ru: "сум",
  en: "",
};

/**
 * The grouped digits alone, with no currency after them.
 *
 * The catalog's price filter needs this: its heading already says "so'm", and
 * repeating the unit inside both ends of the range would double the width of a
 * control that has to fit a sidebar.
 */
export function formatNumber(amount: number, locale: Locale): string {
  return Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, GROUP_SEPARATOR[locale]);
}

/**
 * Reads a grouped amount back, whichever separator was typed.
 *
 * Everything that is not a digit is dropped rather than rejected: the reader
 * pastes "3 450 000", "3,450,000" or "3450000 so'm" and all three mean the same
 * number. An entry with no digits at all is `null` — an empty end of the range,
 * not zero.
 */
export function parseAmount(input: string): number | null {
  const digits = input.replace(/\D/g, "");
  return digits === "" ? null : Number(digits);
}

/**
 * Formats a UZS amount for display. Returns `null` for an unpriced product so
 * callers must decide what to show instead of falling back to a bogus zero.
 */
export function formatPrice(amount: number | null, locale: Locale): string | null {
  if (amount === null || !Number.isFinite(amount)) {
    return null;
  }

  const formatted = formatNumber(amount, locale);
  return locale === "en" ? `${CURRENCY} ${formatted}` : `${formatted} ${SUFFIX[locale]}`;
}

/** Sums the priced lines; `unpriced` counts the lines that have no price yet. */
export function sumPrices(
  lines: readonly { price: number | null; quantity: number }[]
): { total: number; unpriced: number } {
  let total = 0;
  let unpriced = 0;

  for (const line of lines) {
    if (line.price === null) {
      unpriced += 1;
      continue;
    }
    total += line.price * line.quantity;
  }

  return { total, unpriced };
}
