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

function formatAmount(amount: number, locale: Locale): string {
  return Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, GROUP_SEPARATOR[locale]);
}

/**
 * Formats a UZS amount for display. Returns `null` for an unpriced product so
 * callers must decide what to show instead of falling back to a bogus zero.
 */
export function formatPrice(amount: number | null, locale: Locale): string | null {
  if (amount === null || !Number.isFinite(amount)) {
    return null;
  }

  const formatted = formatAmount(amount, locale);
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
