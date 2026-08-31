"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import * as Popover from "@radix-ui/react-popover";
import { AnimatePresence, motion } from "motion/react";
import { MOTION } from "@/components/providers/motion-provider";
import { ChevronRight, Menu, X } from "lucide-react";
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

/** Each right-hand column holds at most this many links before the rest hide behind "show more". */
const COLUMN_ITEM_LIMIT = 5;
/** Columns visible before a section's own subcategories start hiding behind "show more". */
const MAX_COLUMNS = 3;

const GRID_CLASS_BY_COLUMN_COUNT: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-2 lg:grid-cols-3",
};

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

/**
 * The catalog menu: a left rail of sections and a right panel for whichever
 * one is active — the shape Uzum-style mega-menus use, adapted to a catalog
 * that is only two levels deep (a root and its direct subcategories, see
 * `lib/catalog-tree.ts`). There is no third level to give each right-panel
 * column its own heading, so a section's subcategories are split across up to
 * three columns purely for layout, with the section's own name as the single
 * heading above them.
 *
 * The left rail switches on hover *and* focus, so a keyboard user tabbing
 * through it previews a section the same way a mouse does. Radix still owns
 * open/close on click, outside-click and Escape — a menu this size opening
 * because a pointer crossed the header would be a menu that opens by
 * accident.
 */
export function CatalogMegaMenu({
  lang,
  header,
  allProductsLabel,
  className,
}: CatalogMegaMenuProps) {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const { items, isLoading, isError, retry } = useCatalogTree(open);

  const activeRoot = useMemo(
    () => items.find((root) => root.id === activeId) ?? items[0],
    [items, activeId]
  );

  function closeMenu() {
    setOpen(false);
    setActiveId(null);
    setExpanded(false);
  }

  function hoverRoot(id: string) {
    setActiveId(id);
    setExpanded(false);
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setActiveId(null);
          setExpanded(false);
        }
      }}
    >
      <Popover.Trigger
        className={cn(
          "inline-flex h-10 shrink-0 items-center gap-2 rounded-md border border-accent-edge bg-accent px-4 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover active:bg-accent-active",
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
                className="z-100 flex max-h-[min(34rem,calc(100vh-8rem))] w-[min(64rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-border bg-surface-elevated shadow-2xl"
              >
                {isError ? (
                  <div className="min-h-0 flex-1 overflow-y-auto p-6">
                    <CatalogFailure
                      message={header.catalogError}
                      retryLabel={header.catalogRetry}
                      onRetry={retry}
                    />
                  </div>
                ) : isLoading ? (
                  <div className="min-h-0 flex-1 overflow-y-auto p-6">
                    <CatalogSkeleton label={header.catalogLoading} />
                  </div>
                ) : items.length === 0 ? (
                  <p className="flex-1 py-6 text-center text-sm text-muted">
                    {header.catalogEmpty}
                  </p>
                ) : activeRoot ? (
                  <div className="flex min-h-0 flex-1">
                    <nav
                      aria-label={header.catalog}
                      className="w-56 shrink-0 overflow-y-auto border-r border-border py-3"
                    >
                      <ul>
                        {items.map((root) => {
                          const isActive = root.id === activeRoot.id;
                          return (
                            <li key={root.id}>
                              <Link
                                href={`/products?group=${root.slug}`}
                                onMouseEnter={() => hoverRoot(root.id)}
                                onFocus={() => hoverRoot(root.id)}
                                onClick={closeMenu}
                                aria-current={isActive ? "true" : undefined}
                                className={cn(
                                  "flex items-center gap-2.5 border-l-2 px-4 py-2.5 text-sm transition-colors",
                                  isActive
                                    ? "border-accent bg-surface-hover font-medium text-accent-strong"
                                    : "border-transparent text-foreground hover:bg-surface-hover"
                                )}
                              >
                                {root.icon ? (
                                  <span
                                    className={cn(
                                      "shrink-0",
                                      isActive ? "text-accent-strong" : "text-muted"
                                    )}
                                  >
                                    <CatalogIcon icon={root.icon} />
                                  </span>
                                ) : null}
                                <span className="min-w-0 flex-1 truncate">{root.name[lang]}</span>
                                <Icon
                                  icon={ChevronRight}
                                  size="xs"
                                  className={cn(
                                    "shrink-0 transition-opacity",
                                    isActive ? "opacity-100 text-accent-strong" : "opacity-0"
                                  )}
                                />
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </nav>

                    <div className="min-w-0 flex-1 overflow-y-auto p-6">
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={activeRoot.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={MOTION.fade}
                        >
                          <CatalogSectionPanel
                            root={activeRoot}
                            lang={lang}
                            expanded={expanded}
                            onExpand={() => setExpanded(true)}
                            showMoreLabel={header.catalogShowMore}
                            viewAllLabel={header.catalogViewAll}
                            onNavigate={closeMenu}
                          />
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </div>
                ) : null}

                <div className="shrink-0 border-t border-border px-6 py-3">
                  <Link
                    href="/products"
                    onClick={closeMenu}
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
 * The right panel for one section: its own name as the heading, its
 * subcategories split into up to `MAX_COLUMNS` columns of `COLUMN_ITEM_LIMIT`
 * each. Beyond that the rest sit behind a "show more" link rather than
 * growing the panel — the columns are a layout device, not a semantic group,
 * so nothing is lost by keeping them hidden until asked for.
 */
function CatalogSectionPanel({
  root,
  lang,
  expanded,
  onExpand,
  showMoreLabel,
  viewAllLabel,
  onNavigate,
}: {
  root: CatalogNode;
  lang: Locale;
  expanded: boolean;
  onExpand: () => void;
  showMoreLabel: string;
  viewAllLabel: string;
  onNavigate: () => void;
}) {
  const visibleLimit = MAX_COLUMNS * COLUMN_ITEM_LIMIT;
  const visible = expanded ? root.children : root.children.slice(0, visibleLimit);
  const hiddenCount = root.children.length - visible.length;
  const columns = chunk(visible, COLUMN_ITEM_LIMIT);
  const gridClass = GRID_CLASS_BY_COLUMN_COUNT[Math.min(columns.length, MAX_COLUMNS)] ?? "grid-cols-1";

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4 border-b border-border pb-3">
        <Link
          href={`/products?group=${root.slug}`}
          onClick={onNavigate}
          className="group flex min-w-0 items-center gap-2.5"
        >
          {root.icon ? (
            <span className="shrink-0 text-accent-strong">
              <CatalogIcon icon={root.icon} size="md" />
            </span>
          ) : null}
          <span className="truncate text-base font-semibold text-foreground transition-colors group-hover:text-accent-strong">
            {root.name[lang]}
          </span>
        </Link>
        <Link
          href={`/products?group=${root.slug}`}
          onClick={onNavigate}
          className="shrink-0 text-sm text-accent-strong hover:underline"
        >
          {viewAllLabel}
        </Link>
      </div>

      {columns.length > 0 ? (
        <div className={cn("grid gap-x-8 gap-y-6", gridClass)}>
          {columns.map((column, columnIndex) => (
            <ul key={columnIndex} className="space-y-1">
              {column.map((child) => (
                <li key={child.id}>
                  <Link
                    href={`/products?category=${child.slug}`}
                    onClick={onNavigate}
                    className="flex items-center gap-2 truncate rounded-sm py-1.5 text-sm text-muted transition-colors hover:text-accent-strong"
                  >
                    {child.icon ? <CatalogIcon icon={child.icon} size="xs" /> : null}
                    <span className="truncate">{child.name[lang]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ))}
        </div>
      ) : null}

      {hiddenCount > 0 ? (
        <button
          type="button"
          onClick={onExpand}
          className="mt-4 text-sm text-accent-strong hover:underline"
        >
          {showMoreLabel.replace("{count}", String(hiddenCount))}
        </button>
      ) : null}
    </div>
  );
}

/**
 * The panel's shape before the answer arrives: a rail of bars on the left,
 * a heading and column bars on the right — the same two-panel silhouette the
 * real content fills in, so nothing shifts once it lands.
 */
function CatalogSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true" className="flex gap-8">
      <span className="sr-only">{label}</span>
      <div className="w-56 shrink-0 space-y-3" aria-hidden="true">
        {Array.from({ length: 8 }, (_, row) => (
          <div
            key={row}
            className="h-3.5 animate-pulse rounded-sm bg-surface-hover"
            style={{ width: `${80 - (row % 3) * 14}%` }}
          />
        ))}
      </div>
      <div className="min-w-0 flex-1" aria-hidden="true">
        <div className="h-4 w-1/3 animate-pulse rounded-sm bg-surface-hover" />
        <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-2.5 lg:grid-cols-3">
          {Array.from({ length: 15 }, (_, row) => (
            <div
              key={row}
              className="h-3 animate-pulse rounded-sm bg-surface-muted"
              style={{ width: `${85 - (row % 4) * 12}%` }}
            />
          ))}
        </div>
      </div>
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
