import uz from "@/dictionaries/uz.json";
import ru from "@/dictionaries/ru.json";
import en from "@/dictionaries/en.json";
import { DEFAULT_LOCALE, isLocale, type Locale } from "./locales";

export type Dictionary = typeof uz;

const dictionaries: Record<Locale, Dictionary> = { uz, ru, en };

export function hasLocale(locale: string): locale is Locale {
  return isLocale(locale);
}

export function getDictionary(locale: string): Dictionary {
  const resolved = hasLocale(locale) ? locale : DEFAULT_LOCALE;
  return dictionaries[resolved];
}
