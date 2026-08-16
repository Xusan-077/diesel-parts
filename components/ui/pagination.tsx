"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { getPageItems } from "@/lib/pagination";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";

export interface PaginationLabels {
  /** Names the landmark, e.g. "Catalog pages". */
  nav: string;
  prev: string;
  next: string;
  /** `"{current} / {total}"` — the compact mobile read-out. */
  indicator: string;
  /** `"Page {page}"` — accessible name for a numbered button. */
  page: string;
}

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  labels: PaginationLabels;
  className?: string;
}

/**
 * Every control is a 44px square, the minimum comfortable touch target, so the
 * same markup serves finger and cursor.
 *
 * Below `sm` the numbered pages are replaced by a "3 / 12" read-out: eleven
 * numbers plus two arrows cannot fit a 390px screen without shrinking past
 * that target, and paging one step at a time is the honest mobile gesture
 * anyway. From `sm` up the numbers return and the read-out steps aside.
 */
export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  labels,
  className,
}: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const items = getPageItems(currentPage, totalPages);
  const isFirst = currentPage <= 1;
  const isLast = currentPage >= totalPages;

  // `min-w-11` matters on mobile, where these collapse to a bare chevron and
  // the horizontal padding alone leaves them 40px wide.
  const stepClass =
    "inline-flex h-11 min-w-11 items-center justify-center gap-1 rounded-md px-3 text-sm text-foreground transition-colors hover:bg-surface-hover disabled:pointer-events-none disabled:opacity-40";

  return (
    <nav aria-label={labels.nav} className={cn("flex justify-center", className)}>
      <ul className="flex items-center gap-1">
        <li>
          <button
            type="button"
            disabled={isFirst}
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            className={stepClass}
          >
            <Icon icon={ChevronLeft} />
            <span className="hidden sm:inline">{labels.prev}</span>
            <span className="sr-only sm:hidden">{labels.prev}</span>
          </button>
        </li>

        {/* Compact read-out: mobile only. */}
        <li aria-hidden className="px-3 text-sm tabular-nums text-muted sm:hidden">
          {labels.indicator
            .replace("{current}", String(currentPage))
            .replace("{total}", String(totalPages))}
        </li>

        {items.map((item, index) =>
          item === "ellipsis" ? (
            <li
              key={`gap-${index}`}
              aria-hidden
              className="hidden h-11 w-8 place-items-center text-sm text-muted sm:grid"
            >
              &hellip;
            </li>
          ) : (
            <li key={item} className="hidden sm:block">
              <button
                type="button"
                aria-label={labels.page.replace("{page}", String(item))}
                aria-current={item === currentPage ? "page" : undefined}
                onClick={() => onPageChange(item)}
                className={cn(
                  "h-11 min-w-11 rounded-md px-2 text-sm tabular-nums transition-colors",
                  item === currentPage
                    ? "bg-accent font-semibold text-accent-foreground"
                    : "text-foreground hover:bg-surface-hover"
                )}
              >
                {item}
              </button>
            </li>
          )
        )}

        <li>
          <button
            type="button"
            disabled={isLast}
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            className={stepClass}
          >
            <span className="hidden sm:inline">{labels.next}</span>
            <span className="sr-only sm:hidden">{labels.next}</span>
            <Icon icon={ChevronRight} />
          </button>
        </li>
      </ul>
    </nav>
  );
}
