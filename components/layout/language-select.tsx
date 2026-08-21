"use client";

import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSelectableItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/hooks/use-store";
import { SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/locales";
import { FlagIcon } from "./flag-icon";
import { Icon } from "@/components/ui/icon";

const LOCALE_LABELS: Record<Locale, string> = { uz: "UZ", ru: "RU", en: "EN" };

/**
 * `lang` is the language the server rendered this page in. It seeds the
 * displayed value so the first client render matches the HTML, and the store
 * takes over once it has read localStorage.
 */
export function LanguageSelect({ lang, label }: { lang: Locale; label: string }) {
  const router = useRouter();
  const { language, setLanguage } = useLanguage(lang);

  function choose(locale: Locale) {
    if (locale === language) {
      return;
    }

    setLanguage(locale);
    // Every string on the page was rendered on the server from the cookie
    // `setLanguage` just wrote, so the new language arrives with the refresh
    // rather than with the state update.
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
      >
        <FlagIcon locale={language} className="h-3 w-4.5 shrink-0 rounded-xs" />
        <span className="font-medium">{LOCALE_LABELS[language]}</span>
        <Icon icon={ChevronDown} size="xs" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-[7rem]">
        {SUPPORTED_LOCALES.map((locale) => (
          <DropdownMenuSelectableItem
            key={locale}
            selected={locale === language}
            onSelect={() => choose(locale)}
          >
            <FlagIcon locale={locale} className="h-3 w-4.5 shrink-0 rounded-xs" />
            {LOCALE_LABELS[locale]}
          </DropdownMenuSelectableItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
