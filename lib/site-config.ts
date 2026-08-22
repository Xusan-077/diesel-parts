import type { Metadata } from "next";

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

/**
 * The two channels the floating support widget offers. Kept here, beside the
 * numbers the header and footer already read, so the widget has exactly one
 * knob per channel and no copy of a phone number lives in a component.
 */
export interface SupportContact {
  /** Telegram handle, stored without the leading `@`. */
  telegramUsername: string;
  /** Which of the numbers above the "call" row dials. */
  phone: SitePhone;
}

/** TODO(Xusan): confirm the support handle before launch — see SITE_PHONES. */
export const SUPPORT_CONTACT: SupportContact = {
  telegramUsername: "dieselparts_uz",
  phone: SITE_PHONES[0],
};

/** `t.me` link for a handle stored without its `@`. */
export function telegramHref(username: string): string {
  return `https://t.me/${username.replace(/^@/, "")}`;
}

/**
 * The icon set, shared by both root layouts — the storefront and the panel.
 *
 * It is declared here rather than through the `app/icon.*` file convention on
 * purpose. There is no single root layout to hang the convention off (the
 * storefront and the panel are two separate roots), and Next only injects a
 * convention icon when a segment leaves `metadata.icons` unset — so the moment
 * either layout declares icons of its own, a stray `app/favicon.ico` would go
 * silently unused while still shadowing `public/favicon.ico` on the
 * `/favicon.ico` route. One explicit list, two consumers, no shadowing.
 *
 * `favicon.ico` stays last: it is the legacy fallback, and browsers that
 * understand the PNGs should pick the sharp one ahead of it.
 */
export const SITE_ICONS: Metadata["icons"] = {
  icon: [
    { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
    { url: "/favicon.ico", sizes: "any" },
  ],
  apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
};

/**
 * Social preview card. Width and height are stated so crawlers that do not
 * fetch the file still lay the card out at 1.91:1 instead of guessing.
 */
export const OG_IMAGE = {
  url: "/og-image.png",
  width: 1200,
  height: 630,
  type: "image/png",
} as const;
