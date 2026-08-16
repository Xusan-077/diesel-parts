import type { Metadata } from "next";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, isLocale } from "@/lib/i18n/locales";
import { OG_LOCALES } from "@/lib/site-config";

/**
 * Canonical URL plus the hreflang set for one page.
 *
 * This has to be set per page rather than once in the layout: Next.js passes
 * a layout's `alternates` down to every page that does not define its own, so
 * a single canonical in the layout would tell crawlers that all 20 pages are
 * the locale's home page.
 *
 * @param lang Locale segment as it came off the route params; an unrecognised
 *   value canonicalises to the default locale rather than emitting a URL for a
 *   locale that does not exist.
 * @param path Route below the locale segment, e.g. `/products`. Empty for home.
 */
export function localeAlternates(lang: string, path = ""): Metadata["alternates"] {
  const locale = isLocale(lang) ? lang : DEFAULT_LOCALE;
  return {
    canonical: `/${locale}${path}`,
    languages: {
      ...Object.fromEntries(SUPPORTED_LOCALES.map((l) => [OG_LOCALES[l], `/${l}${path}`])),
      "x-default": `/${DEFAULT_LOCALE}${path}`,
    },
  };
}
