export const SUPPORTED_LOCALES = ["uz", "ru", "en"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "uz";

/**
 * The localStorage key `useLanguageStore` persists under, and the cookie the
 * same store mirrors the choice into.
 *
 * Both exist because the choice has two readers. localStorage is the store's
 * own home; the cookie is the only copy a server component can see, and every
 * page still renders its text on the server. They are written together — see
 * lib/store/language-store.ts — so they never disagree for longer than the
 * first mount after a visitor clears one of them.
 */
export const LANGUAGE_STORAGE_KEY = "language-storage";
export const LANGUAGE_COOKIE = "language";

/** A year: the choice should outlive the session, like the theme does. */
export const LANGUAGE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/** Anything unrecognised — a cleared cookie, a hand-edited value — reads as Uzbek. */
export function parseLocale(value: unknown): Locale {
  return typeof value === "string" && isLocale(value) ? value : DEFAULT_LOCALE;
}
