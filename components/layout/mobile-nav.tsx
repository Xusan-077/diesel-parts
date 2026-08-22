"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import { MOTION } from "@/components/providers/motion-provider";
import { ChevronDown, Menu, Phone, X } from "lucide-react";
import { CatalogIcon } from "@/components/catalog/catalog-icon";
import { cn } from "@/lib/utils";
import { useCatalogTree } from "@/hooks/use-catalog-tree";
import { buildMainNav, isNavItemActive } from "@/lib/nav";
import { SITE_PHONES } from "@/lib/site-config";
import { SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/locales";
import { useLanguage } from "@/hooks/use-store";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { FlagIcon } from "./flag-icon";
import { Icon } from "@/components/ui/icon";

interface MobileMenuProps {
  lang: Locale;
  siteName: string;
  nav: Dictionary["nav"];
  header: Dictionary["header"];
  closeLabel: string;
  /** Shown on the link that opens a whole section rather than one entry. */
  viewAllLabel: string;
  className?: string;
}

export function MobileMenu({
  lang,
  siteName,
  nav,
  header,
  closeLabel,
  viewAllLabel,
  className,
}: MobileMenuProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const items = buildMainNav(nav);
  const { language, setLanguage } = useLanguage(lang);
  // Same cache as the desktop menu, and the same reason for waiting until the
  // drawer opens: most visits never open it.
  const catalog = useCatalogTree(open);

  function close() {
    setOpen(false);
  }

  function chooseLanguage(locale: Locale) {
    close();

    if (locale === language) {
      return;
    }

    setLanguage(locale);
    // The drawer's own labels come from the server too, so the refresh is what
    // actually translates them.
    router.refresh();
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        aria-label={nav.menu}
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-foreground transition-colors hover:bg-surface-hover",
          className
        )}
      >
        <Icon icon={Menu} size="lg" />
      </Dialog.Trigger>

      <Dialog.Portal forceMount>
        <AnimatePresence>
          {open ? (
            <Dialog.Overlay asChild forceMount key="overlay">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={MOTION.fade}
                className="fixed inset-0 z-100 bg-black/60"
              />
            </Dialog.Overlay>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {open ? (
            <Dialog.Content asChild forceMount key="drawer" aria-describedby={undefined}>
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={MOTION.drawer}
                className="fixed inset-y-0 left-0 z-100 flex w-full max-w-sm flex-col overflow-y-auto bg-background text-foreground"
              >
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
            <Dialog.Title className="text-lg font-semibold">{siteName}</Dialog.Title>
            <Dialog.Close
              aria-label={closeLabel}
              className="flex h-10 w-10 items-center justify-center rounded-md transition-colors hover:bg-surface-hover"
            >
              <Icon icon={X} size="lg" />
            </Dialog.Close>
          </div>

          <section className="px-4 pt-2">
            <p className="py-2 text-xs font-medium uppercase tracking-wide text-muted">
              {header.catalog}
            </p>

            {catalog.isError ? (
              <div role="alert" className="flex flex-col items-start gap-2 py-3">
                <p className="text-sm text-muted">{header.catalogError}</p>
                <button
                  type="button"
                  onClick={catalog.retry}
                  className="rounded-md border border-border-strong px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-surface-hover"
                >
                  {header.catalogRetry}
                </button>
              </div>
            ) : catalog.isLoading ? (
              <div aria-busy="true" className="py-1">
                <span className="sr-only">{header.catalogLoading}</span>
                {Array.from({ length: 6 }, (_, row) => (
                  <div key={row} aria-hidden="true" className="border-b border-border py-4">
                    <div
                      className="h-3.5 animate-pulse rounded-sm bg-surface-hover"
                      style={{ width: `${70 - (row % 3) * 12}%` }}
                    />
                  </div>
                ))}
              </div>
            ) : catalog.items.length === 0 ? (
              <p className="py-3 text-sm text-muted">{header.catalogEmpty}</p>
            ) : (
              catalog.items.map((root) => (
                <details key={root.id} className="group border-b border-border">
                  <summary className="flex cursor-pointer list-none items-center justify-between py-3 text-base transition-colors hover:text-accent-strong [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center gap-2.5">
                      {root.icon ? (
                        <span className="text-accent-strong">
                          <CatalogIcon icon={root.icon} />
                        </span>
                      ) : null}
                      {root.name[lang]}
                    </span>
                    <Icon
                      icon={ChevronDown}
                      className="text-muted transition-transform duration-200 group-open:rotate-180"
                    />
                  </summary>
                  <ul className="pb-2">
                    {/* The section itself is a destination too — on a phone the
                        heading is the only way to reach a whole column. */}
                    <li>
                      <Link
                        href={`/products?group=${root.slug}`}
                        onClick={close}
                        className="flex items-center gap-2.5 py-2 pl-2 text-sm text-accent-strong"
                      >
                        {root.name[lang]} — {viewAllLabel}
                      </Link>
                    </li>
                    {root.children.map((child) => (
                      <li key={child.id}>
                        <Link
                          href={`/products?category=${child.slug}`}
                          onClick={close}
                          className="flex items-center gap-2.5 py-2 pl-2 text-sm text-muted transition-colors hover:text-accent-strong"
                        >
                          {child.icon ? <CatalogIcon icon={child.icon} /> : null}
                          {child.name[lang]}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </details>
              ))
            )}
          </section>

          <nav className="flex flex-col px-4 py-2">
            {items.map((item) => {
              const active = isNavItemActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={close}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "border-b border-border py-3.5 text-base transition-colors",
                    active ? "text-accent-strong" : "hover:text-accent-strong"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="px-4 py-2">
            <Link
              href="/request-quote"
              onClick={close}
              className="flex h-11 items-center justify-center rounded-md bg-accent text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90"
            >
              {nav.requestQuote}
            </Link>
          </div>

          <div className="flex flex-col gap-2 px-4 py-3">
            {SITE_PHONES.map((phone) => (
              <a
                key={phone.tel}
                href={`tel:${phone.tel}`}
                className="flex items-center gap-2 text-sm text-muted transition-colors hover:text-foreground"
              >
                <Icon icon={Phone} />
                {phone.display}
              </a>
            ))}
          </div>

          <div className="mt-auto flex items-center gap-2 border-t border-border px-4 py-4">
            <span className="mr-1 text-xs text-muted">{header.languageLabel}:</span>
            {SUPPORTED_LOCALES.map((locale) => (
              <button
                key={locale}
                type="button"
                onClick={() => chooseLanguage(locale)}
                aria-current={locale === language ? "true" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs uppercase transition-colors",
                  locale === language ? "bg-surface-hover text-accent-strong" : "text-muted"
                )}
              >
                <FlagIcon locale={locale} className="h-3 w-4.5 rounded-xs" />
                {locale}
              </button>
            ))}
          </div>
              </motion.div>
            </Dialog.Content>
          ) : null}
        </AnimatePresence>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
