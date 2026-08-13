export const SUPPORTED_LOCALES = ["uz", "ru", "en"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "uz";

export function isLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function switchLocalePath(pathname: string, targetLocale: Locale): string {
  const segments = pathname.split("/");

  if (segments.length > 1 && isLocale(segments[1])) {
    segments[1] = targetLocale;
    return segments.join("/");
  }

  return `/${targetLocale}${pathname}`;
}
