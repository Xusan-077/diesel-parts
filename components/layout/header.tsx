"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHeaderScroll } from "@/hooks/use-header-scroll";
import { SUPPORTED_LOCALES, switchLocalePath, type Locale } from "@/lib/i18n/locales";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { MobileNav } from "./mobile-nav";

interface HeaderProps {
  lang: Locale;
  siteName: string;
  nav: Dictionary["nav"];
  closeLabel: string;
}

export function Header({ lang, siteName, nav, closeLabel }: HeaderProps) {
  const { solid, hidden } = useHeaderScroll();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { href: `/${lang}/products`, label: nav.products },
    { href: `/${lang}/about`, label: nav.about },
    { href: `/${lang}/blog`, label: nav.blog },
    { href: `/${lang}/contact`, label: nav.contact },
  ];

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-all duration-200",
          solid ? "bg-black" : "bg-transparent",
          hidden ? "-translate-y-full" : "translate-y-0"
        )}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href={`/${lang}`} className="text-lg font-semibold text-white">
            {siteName}
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-white/80 transition-colors hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-4 md:flex">
            <div className="flex items-center gap-1 text-sm text-white/70">
              {SUPPORTED_LOCALES.map((locale) => (
                <Link
                  key={locale}
                  href={switchLocalePath(pathname, locale)}
                  className={cn(
                    "px-1.5 uppercase transition-colors hover:text-white",
                    locale === lang && "text-white"
                  )}
                >
                  {locale}
                </Link>
              ))}
            </div>
            <Link
              href={`/${lang}/request-quote`}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-accent/90"
            >
              {nav.requestQuote}
            </Link>
          </div>

          <button
            type="button"
            aria-label={nav.menu}
            onClick={() => setMobileOpen(true)}
            className="text-white md:hidden"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </header>

      <MobileNav
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        lang={lang}
        nav={nav}
        closeLabel={closeLabel}
        navLinks={navLinks}
        pathname={pathname}
      />
    </>
  );
}
