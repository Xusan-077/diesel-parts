"use client";

import { useState } from "react";
import Link from "next/link";
import * as Popover from "@radix-ui/react-popover";
import { AnimatePresence, motion } from "motion/react";
import { MOTION } from "@/components/providers/motion-provider";
import { ChevronRight, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { catalogGroups } from "@/lib/data/catalog-menu";
import type { Locale } from "@/lib/i18n/locales";
import { CatalogIcon } from "./catalog-icon";
import { Icon } from "@/components/ui/icon";

interface CatalogMegaMenuProps {
  lang: Locale;
  label: string;
  viewAllLabel: string;
  className?: string;
}

export function CatalogMegaMenu({ lang, label, viewAllLabel, className }: CatalogMegaMenuProps) {
  const [open, setOpen] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState(catalogGroups[0].id);

  const activeGroup = catalogGroups.find((group) => group.id === activeGroupId) ?? catalogGroups[0];

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className={cn(
          "inline-flex h-10 shrink-0 items-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90",
          className
        )}
      >
        {open ? <Icon icon={X} /> : <Icon icon={Menu} />}
        {label}
      </Popover.Trigger>

      <Popover.Portal forceMount>
        <AnimatePresence>
          {open ? (
            <Popover.Content asChild forceMount key="panel" align="start" sideOffset={8}>
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={MOTION.pop}
                className="z-100 w-[min(64rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-border bg-surface shadow-2xl"
              >
          <div className="flex">
            <ul className="w-64 shrink-0 border-r border-border py-2">
              {catalogGroups.map((group) => {
                const active = group.id === activeGroup.id;
                return (
                  <li key={group.id}>
                    <button
                      type="button"
                      // Hover and keyboard focus both swap the panel, so the
                      // menu is usable without a click either way.
                      onMouseEnter={() => setActiveGroupId(group.id)}
                      onFocus={() => setActiveGroupId(group.id)}
                      onClick={() => setActiveGroupId(group.id)}
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm transition-colors",
                        active
                          ? "bg-surface-hover text-accent-strong"
                          : "text-foreground hover:text-accent-strong"
                      )}
                    >
                      <span>{group.name[lang]}</span>
                      <Icon icon={ChevronRight} className="shrink-0" />
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="min-w-0 flex-1 p-5">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-base font-semibold text-foreground">
                  {activeGroup.name[lang]}
                </h2>
                <Link
                  href={`/${lang}/products?group=${activeGroup.slug}`}
                  onClick={() => setOpen(false)}
                  className="shrink-0 text-sm text-accent-strong hover:underline"
                >
                  {viewAllLabel}
                </Link>
              </div>

              <ul className="mt-5 grid max-h-[26rem] grid-cols-3 gap-3 overflow-y-auto">
                {activeGroup.subcategories.map((subcategory) => (
                  <li key={subcategory.id}>
                    <Link
                      href={`/${lang}/products?category=${subcategory.slug}`}
                      onClick={() => setOpen(false)}
                      className="group flex h-full flex-col items-center gap-2 rounded-lg border border-transparent p-3 text-center transition-colors hover:border-border hover:bg-surface-muted"
                    >
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent-strong">
                        <CatalogIcon icon={subcategory.icon} size="lg" />
                      </span>
                      <span className="text-xs leading-snug text-foreground transition-colors group-hover:text-accent-strong">
                        {subcategory.name[lang]}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
              </motion.div>
            </Popover.Content>
          ) : null}
        </AnimatePresence>
      </Popover.Portal>
    </Popover.Root>
  );
}
