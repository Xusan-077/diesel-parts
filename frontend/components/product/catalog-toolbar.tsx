"use client";

import { LayoutGrid, List, Loader2 } from "lucide-react";
import type { SortKey } from "@/lib/filters";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { Select } from "@/components/ui/select";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

/**
 * The bar above the grid: how many results, how they are ordered, how they are
 * drawn.
 *
 * Sort and view are here rather than in the filter panel because they change
 * the *presentation* of a result set, not the set itself — which is also why
 * "clear filters" leaves them alone. The result count sits beside them because
 * it is the answer the filters produced.
 */
export function CatalogToolbar({
  total,
  isFetching,
  sortKey,
  onSortChange,
  view,
  onViewChange,
  dict,
  filterSlot,
}: {
  total: number;
  isFetching: boolean;
  sortKey: SortKey;
  onSortChange: (value: SortKey) => void;
  view: "grid" | "list";
  onViewChange: (value: "grid" | "list") => void;
  dict: Dictionary["catalog"];
  /** The mobile filter trigger. Absent on wide screens, where the sidebar shows. */
  filterSlot?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border pb-4">
      {filterSlot}

      <div className="flex items-center gap-2">
        <p className="text-sm tabular-nums text-muted">
          {dict.resultsCount.replace("{count}", String(total))}
        </p>
        {isFetching ? (
          <Icon
            icon={Loader2}
            aria-hidden={false}
            aria-label={dict.loading}
            className="animate-spin text-muted"
          />
        ) : null}
      </div>

      <div className="ml-auto flex items-center gap-3">
        <Select
          value={sortKey}
          onChange={(event) => onSortChange(event.target.value as SortKey)}
          aria-label={dict.sortLabel}
          wrapperClassName="w-44"
        >
          <option value="newest">{dict.sortNewest}</option>
          <option value="name-asc">{dict.sortNameAsc}</option>
          <option value="name-desc">{dict.sortNameDesc}</option>
        </Select>

        {/* Icons, not words: "Katak ko'rinish" and "Ro'yxat ko'rinishi" as
            two buttons took more room than the sort control beside them. */}
        <div
          role="group"
          aria-label={dict.viewLabel}
          className="hidden items-center rounded-md border border-border-strong sm:flex"
        >
          {(
            [
              { value: "grid", icon: LayoutGrid, label: dict.gridView },
              { value: "list", icon: List, label: dict.listView },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              aria-label={option.label}
              aria-pressed={view === option.value}
              title={option.label}
              onClick={() => onViewChange(option.value)}
              className={cn(
                "flex h-9 w-9 items-center justify-center transition-colors first:rounded-l-md last:rounded-r-md",
                view === option.value
                  ? "bg-accent text-accent-foreground"
                  : "text-muted hover:text-foreground"
              )}
            >
              <Icon icon={option.icon} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
