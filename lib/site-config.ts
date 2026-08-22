import type { GeoPoint } from "./map-links";

/**
 * Canonical origin, used for metadata, the sitemap and robots.txt. Set
 * NEXT_PUBLIC_SITE_URL per environment so preview deploys do not emit
 * canonicals pointing at production.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://diesel-parts.uz";

/** BCP-47 tags for the locale segments, for hreflang and og:locale. */
export const OG_LOCALES = {
  uz: "uz-UZ",
  ru: "ru-RU",
  en: "en-US",
} as const;

export interface SitePhone {
  /** Human-readable form shown in the header. */
  display: string;
  /** Digits-only form used in the `tel:` href. */
  tel: string;
}

/** Display name used where the company is named rather than the site brand. */
export const COMPANY_NAME = "Diesel Parts";

/**
 * TODO(Xusan): replace with the real DieselParts numbers before launch.
 * These are deliberate placeholders — shipping them is better than shipping
 * another company's real numbers, but they must not go live as-is.
 */
export const SITE_PHONES: SitePhone[] = [
  { display: "+998 97 425-27-00", tel: "+998974252700" },
  { display: "+998 90 136-22-77", tel: "+998901362277" },
];

/**
 * The office pin, shared by the footer's location card and its map embed so
 * the coordinates on screen and the ones behind the links can never drift.
 * Taken from the Yandex Maps share link for the showroom.
 */
export const SITE_LOCATION: GeoPoint = { lat: 41.186136, lon: 69.196655 };
