"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { SUPPORTED_LOCALES, switchLocalePath, type Locale } from "@/lib/i18n/locales";
import type { Dictionary } from "@/lib/i18n/dictionaries";

interface NavLink {
  href: string;
  label: string;
}

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
  lang: Locale;
  nav: Dictionary["nav"];
  closeLabel: string;
  navLinks: NavLink[];
  pathname: string;
}

export function MobileNav({
  open,
  onClose,
  lang,
  nav,
  closeLabel,
  navLinks,
  pathname,
}: MobileNavProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-60 flex flex-col bg-black text-white">
      <div className="flex h-16 items-center justify-end px-6">
        <button type="button" aria-label={closeLabel} onClick={onClose}>
          <X className="h-7 w-7" />
        </button>
      </div>

      <nav className="flex flex-1 flex-col items-center justify-center gap-8">
        {navLinks.map((link) => (
          <Link key={link.href} href={link.href} onClick={onClose} className="text-3xl font-medium">
            {link.label}
          </Link>
        ))}

        <Link
          href={`/${lang}/request-quote`}
          onClick={onClose}
          className="mt-4 rounded-md bg-accent px-6 py-3 text-lg font-medium text-black"
        >
          {nav.requestQuote}
        </Link>

        <div className="mt-8 flex items-center gap-4 text-sm uppercase text-white/70">
          {SUPPORTED_LOCALES.map((locale) => (
            <Link
              key={locale}
              href={switchLocalePath(pathname, locale)}
              onClick={onClose}
              className={locale === lang ? "text-white" : undefined}
            >
              {locale}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
