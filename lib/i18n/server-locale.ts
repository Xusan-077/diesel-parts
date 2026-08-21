import "server-only";
import { cookies } from "next/headers";
import { getDictionary, type Dictionary } from "./dictionaries";
import { LANGUAGE_COOKIE, parseLocale, type Locale } from "./locales";

/**
 * The locale for the current request.
 *
 * The visitor's choice lives in a zustand store persisted to localStorage,
 * which the server cannot read; the store mirrors it into a cookie for exactly
 * this call. Reading a cookie opts the page out of static rendering — that is
 * the price of taking the locale out of the URL, and it is paid deliberately:
 * the alternative is shipping all three dictionaries to the browser and
 * rendering every marketing page as a client component, which would cost the
 * SEO metadata and show a flash of Uzbek to every Russian visitor.
 */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  return parseLocale(store.get(LANGUAGE_COOKIE)?.value);
}

/** `getLocale` for the pages that need the strings but never the code. */
export async function getLocaleDictionary(): Promise<Dictionary> {
  return getDictionary(await getLocale());
}
