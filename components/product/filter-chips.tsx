"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import type { CatalogFilters, FilterChip } from "@/lib/catalog-filters";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * What is currently narrowing the grid, above the grid, each with a way off.
 *
 * The filter panel is not always where the reader is looking: on a phone it is
 * behind a drawer, and on a desktop it is a rail they have scrolled past by
 * page three. Without this row, a short result list and a heavily filtered one
 * are indistinguishable, and undoing one narrowing means going back and reading
 * four controls to find which.
 *
 * A chip names both halves — "Brend: CAT", not "CAT" — because "CAT" alone is a
 * brand, a category and a search term as far as the reader can tell.
 */
export function FilterChips({
  chips,
  dict,
  onRemove,
  onClearAll,
  /**
   * The catalog menu's own scope, e.g. "Dvigatel qismlari".
   *
   * It arrives in the URL rather than in `CatalogFilters` — the menu links
   * here, it is not a control on this page — so it is a link back to the
   * unscoped catalog rather than a state change. It reads as a chip because to
   * the visitor it is one: something narrowing the grid, with a way off.
   */
  scope,
  className,
}: {
  chips: FilterChip[];
  dict: Dictionary["catalog"];
  onRemove: (key: keyof CatalogFilters) => void;
  onClearAll: () => void;
  scope?: { label: string; clearLabel: string };
  className?: string;
}) {
  if (chips.length === 0 && scope === undefined) {
    return null;
  }

  const chipClass =
    "inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-surface py-1 pl-3 pr-1 text-sm text-foreground";

  const removeClass =
    "flex h-5 w-5 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-hover hover:text-accent-strong";

  return (
    <div
      role="group"
      aria-label={dict.filtersActiveTitle}
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      {scope ? (
        // Distinguished by the accent border: this one changes the address,
        // and the others do not.
        <span
          className={cn(
            chipClass,
            "border-accent/40 bg-accent/10 text-accent-strong"
          )}
        >
          {scope.label}
          <Link
            href="/products"
            aria-label={scope.clearLabel}
            title={scope.clearLabel}
            className={cn(removeClass, "hover:bg-accent/20")}
          >
            <Icon icon={X} size="xs" />
          </Link>
        </span>
      ) : null}

      {chips.map((chip) => {
        const remove = dict.filterRemove
          .replace("{label}", chip.label)
          .replace("{value}", chip.value);

        return (
          <span key={chip.key} className={chipClass}>
            <span className="text-muted">{chip.label}:</span>
            {chip.value}
            <button
              type="button"
              onClick={() => onRemove(chip.key)}
              aria-label={remove}
              title={remove}
              className={removeClass}
            >
              <Icon icon={X} size="xs" />
            </button>
          </span>
        );
      })}

      {/*
        Only worth offering once there is more than one thing to clear — with a
        single chip it does exactly what the chip's own ✕ does, one control
        further away.
      */}
      {chips.length > 1 ? (
        <button
          type="button"
          onClick={onClearAll}
          className="text-sm text-accent-strong transition-opacity hover:underline"
        >
          {dict.filtersClearAll}
        </button>
      ) : null}
    </div>
  );
}
