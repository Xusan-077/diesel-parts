import "server-only";
import { getPanelDictionary, type PanelDictionary } from "./panel-dictionary";
import { getLocale } from "./server-locale";
import type { Locale } from "./locales";

/**
 * The panel reads the same `language` cookie the marketing site does.
 *
 * One choice, one cookie: a director who set the site to Russian and then
 * opened the panel should not have to say so twice, and the switcher in the
 * profile menu writes through the same store the site's header uses.
 */
export async function getPanelLocale(): Promise<{ locale: Locale; dict: PanelDictionary }> {
  const locale = await getLocale();
  return { locale, dict: getPanelDictionary(locale) };
}
