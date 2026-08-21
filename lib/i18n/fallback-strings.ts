import { DEFAULT_LOCALE, type Locale } from "./locales";

/**
 * The few strings the error boundary needs, kept out of the dictionaries.
 *
 * `error.tsx` has to be a Client Component, and `getDictionary` imports all
 * three dictionary JSON files — reaching for it here would ship ~70KB of
 * marketing copy to every visitor to cover a screen almost none of them will
 * see. The site's whole i18n design is that the server picks one dictionary and
 * passes the strings down as props, and an error boundary is the one place
 * that cannot receive props. Four sentences per locale is the cheaper half of
 * that trade.
 */
interface ErrorFallbackStrings {
  title: string;
  description: string;
  retry: string;
  home: string;
}

const ERROR_FALLBACK: Record<Locale, ErrorFallbackStrings> = {
  uz: {
    title: "Sahifani ochib bo'lmadi",
    description:
      "Ma'lumotlarni yuklashda xatolik yuz berdi. Odatda bu vaqtinchalik — qayta urinib ko'ring.",
    retry: "Qayta urinish",
    home: "Bosh sahifaga",
  },
  ru: {
    title: "Не удалось открыть страницу",
    description:
      "При загрузке данных произошла ошибка. Обычно это временно — попробуйте ещё раз.",
    retry: "Повторить",
    home: "На главную",
  },
  en: {
    title: "This page could not be loaded",
    description:
      "Something went wrong while loading the data. This is usually temporary — please try again.",
    retry: "Try again",
    home: "Back to home",
  },
};

export function getErrorFallbackStrings(locale: Locale = DEFAULT_LOCALE): ErrorFallbackStrings {
  return ERROR_FALLBACK[locale] ?? ERROR_FALLBACK[DEFAULT_LOCALE];
}

export type { ErrorFallbackStrings };
