"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSelectableItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SUPPORTED_LOCALES, switchLocalePath, type Locale } from "@/lib/i18n/locales";
import { FlagIcon } from "./flag-icon";
import { Icon } from "@/components/ui/icon";

const LOCALE_LABELS: Record<Locale, string> = { uz: "UZ", ru: "RU", en: "EN" };

export function LanguageSelect({ lang, label }: { lang: Locale; label: string }) {
  const pathname = usePathname();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
      >
        <FlagIcon locale={lang} className="h-3 w-4.5 shrink-0 rounded-xs" />
        <span className="font-medium">{LOCALE_LABELS[lang]}</span>
        <Icon icon={ChevronDown} size="xs" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-[7rem]">
        {SUPPORTED_LOCALES.map((locale) => (
          <DropdownMenuSelectableItem key={locale} asChild selected={locale === lang}>
            <Link href={switchLocalePath(pathname, locale)}>
              <FlagIcon locale={locale} className="h-3 w-4.5 shrink-0 rounded-xs" />
              {LOCALE_LABELS[locale]}
            </Link>
          </DropdownMenuSelectableItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
