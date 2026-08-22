"use client";

import { useState } from "react";
import Link from "next/link";
import * as Popover from "@radix-ui/react-popover";
import { AnimatePresence, motion } from "motion/react";
import { MOTION } from "@/components/providers/motion-provider";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCatalogTree } from "@/hooks/use-catalog-tree";
import type { CatalogNode } from "@/lib/catalog-tree";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { CatalogIcon } from "./catalog-icon";
import { Icon } from "@/components/ui/icon";

interface CatalogMegaMenuProps {
  lang: Locale;
  header: Dictionary["header"];
  /** The way out of the menu into the unfiltered catalog. */
  allProductsLabel: string;
  className?: string;
}

/**
 * The catalog menu: every column of the tree on screen at once.
 *
 * A column is a top-level category and the entries under it are its children,
 * so the panel is the catalog's own shape rather than a list of links — which
 * is also why it opens on click and not on hover. A menu this size appearing
 * because a pointer crossed the header is a menu that opens by accident; Radix
 * gives the click trigger its outside-click and Escape handling for free.
 *
 * The tree is fetched, not bundled: the director panel edits it, so a menu
 * compiled into the page would be one deploy behind the catalog. The request
 * only goes out when the panel is first opened — see `useCatalogTree`.
 */
export function CatalogMegaMenu({
  lang,
  header,
  allProductsLabel,
  className,
}: CatalogMegaMenuProps) {
  const [open, setOpen] = useState(false);
  const { items, isLoading, isError, retry } = useCatalogTree(open);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className={cn(
          "inline-flex h-10 shrink-0 items-center gap-2 rounded-md border border-accent-edge bg-accent px-4 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90",
          className
        )}
      >
        {open ? <Icon icon={X} /> : <Icon icon={Menu} />}
        {header.catalog}
      </Popover.Trigger>

      <Popover.Portal forceMount>
        <AnimatePresence>
          {open ? (
            <Popover.Content
              asChild
              forceMount
              key="panel"
              align="start"
              sideOffset={8}
              aria-label={header.catalog}
            >
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={MOTION.pop}
                className="z-100 flex max-h-[min(34rem,calc(100vh-8rem))] w-[min(72rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-2xl"
              >
                <div className="min-h-0 flex-1 overflow-y-auto p-6">
                  {isError ? (
                    <CatalogFailure
                      message={header.catalogError}
                      retryLabel={header.catalogRetry}
                      onRetry={retry}
                    />
                  ) : isLoading ? (
                    <CatalogSkeleton label={header.catalogLoading} />
                  ) : items.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted">{header.catalogEmpty}</p>
                  ) : (
                    <div className="grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {items.map((root) => (
                        <CatalogColumn
                          key={root.id}
                          root={root}
                          lang={lang}
                          onNavigate={() => setOpen(false)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="shrink-0 border-t border-border px-6 py-3">
                  <Link
                    href="/products"
                    onClick={() => setOpen(false)}
                    className="text-sm text-accent-strong hover:underline"
                  >
                    {allProductsLabel}
                  </Link>
                </div>
              </motion.div>
            </Popover.Content>
          ) : null}
        </AnimatePresence>
      </Popover.Portal>
    </Popover.Root>
  );
}

/**
 * One column: the section itself as the heading, its subsections beneath.
 *
 * The rule under the heading is the column's own edge — it picks up the accent
 * when the heading is hovered or focused, so the whole column reads as one
 * target rather than the heading looking like a label that happens to be
 * clickable.
 */
function CatalogColumn({
  root,
  lang,
  onNavigate,
}: {
  root: CatalogNode;
  lang: Locale;
  onNavigate: () => void;
}) {
  return (
    <section className="min-w-0">
      <Link
        href={`/products?group=${root.slug}`}
        onClick={onNavigate}
        className="group flex items-center gap-2 border-b border-border pb-2 transition-colors hover:border-accent focus-visible:border-accent"
      >
        {root.icon ? (
          <span className="text-accent-strong">
            <CatalogIcon icon={root.icon} />
          </span>
        ) : null}
        <span className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-accent-strong">
          {root.name[lang]}
        </span>
      </Link>

      <ul className="mt-2.5 space-y-1">
        {root.children.map((child) => (
          <li key={child.id}>
            <Link
              href={`/products?category=${child.slug}`}
              onClick={onNavigate}
              className="block truncate py-0.5 text-sm text-muted transition-colors hover:text-accent-strong"
            >
              {child.name[lang]}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The panel's shape before the answer arrives.
 *
 * Four columns of bars rather than a spinner: the menu opens under the
 * pointer, so what matters is that the space stops moving once the names land.
 */
function CatalogSkeleton({ label }: { label: string }) {
  return (
    <div
      aria-busy="true"
      className="grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      <span className="sr-only">{label}</span>
      {Array.from({ length: 8 }, (_, column) => (
        <div key={column} aria-hidden="true">
          <div className="h-4 w-2/3 animate-pulse rounded-sm bg-surface-hover" />
          <div className="mt-3.5 space-y-2.5 border-t border-border pt-3.5">
            {Array.from({ length: 5 }, (_, row) => (
              <div
                key={row}
                className="h-3 animate-pulse rounded-sm bg-surface-muted"
                // Ragged like a list of names, rather than five identical bars.
                style={{ width: `${88 - ((column + row) % 4) * 12}%` }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CatalogFailure({
  message,
  retryLabel,
  onRetry,
}: {
  message: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 py-10 text-center">
      <p className="text-sm text-muted">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-md border border-border-strong px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-surface-hover"
      >
        {retryLabel}
      </button>
    </div>
  );
}
