"use client";

import { Checkbox } from "@/components/ui/checkbox";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Brand } from "@/lib/types";
import { cn } from "@/lib/utils";
import { filterRowTone, ShowMoreList } from "./filter-section";

/** How many brands the panel shows before it offers the rest. */
const VISIBLE_BRANDS = 6;

/**
 * The brand's mark, or its initials when there is no mark on file.
 *
 * Most rows have no logo yet, and an empty slot beside every second brand
 * breaks the column the marks are meant to form. Initials keep the rhythm and
 * are still a second thing to recognise the row by — which is the whole reason
 * the mark is here, since the name is already spelled out beside it.
 *
 * Decorative either way: the name is the label, and `alt` text repeating it
 * would have a screen reader say every brand twice.
 */
function BrandMark({ brand }: { brand: Brand }) {
  const tile =
    "flex h-6 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xs border border-border bg-surface";

  // `aria-hidden` on both: the label wraps the box, so anything inside it
  // becomes part of the checkbox's accessible name, and "Komatsu KOM" is not
  // what the reader is ticking.
  if (brand.logoUrl) {
    return (
      <span className={tile} aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element -- brand marks are
            arbitrary external URLs; next/image would need every host allow-listed
            for a 36px decoration. */}
        <img src={brand.logoUrl} alt="" loading="lazy" className="h-full w-full object-contain" />
      </span>
    );
  }

  return (
    <span className={cn(tile, "font-mono text-[0.625rem] tracking-wider text-muted")} aria-hidden>
      {brand.name.slice(0, 3).toUpperCase()}
    </span>
  );
}

export interface BrandFilterProps {
  brands: Brand[];
  /** Ticked brand ids. Empty means every brand. */
  value: string[];
  onToggle: (brandId: string) => void;
  dict: Dictionary["catalog"];
}

/**
 * Brands as a checkbox set.
 *
 * Unlike the category tree, several at once is the normal case here: a
 * mechanic cross-shopping a part wants CAT *and* Komatsu, and the old single
 * select made that impossible to express. Empty means every brand — a list has
 * no "all" row to tick, and adding one that unticks the rest would be a third
 * kind of control in a panel that already has two.
 */
export function BrandFilter({ brands, value, onToggle, dict }: BrandFilterProps) {
  return (
    <ShowMoreList
      items={brands}
      limit={VISIBLE_BRANDS}
      moreLabel={`${dict.showMore} ({count})`}
      lessLabel={dict.showLess}
    >
      {(visible) => (
        // Capped and scrollable once opened: the full list is what the toggle
        // promised, but it must not push the availability group off the rail.
        <ul className="max-h-60 overflow-y-auto">
          {visible.map((brand) => (
            <li key={brand.id}>
              <label
                className={filterRowTone(
                  false,
                  // The tick is what selects, so the row follows it rather than
                  // a prop — one source of truth for "this brand is on".
                  "flex cursor-pointer items-center gap-2 py-1.5 pl-2 pr-1.5 has-checked:border-accent has-checked:bg-accent-subtle"
                )}
              >
                <Checkbox
                  checked={value.includes(brand.id)}
                  onChange={() => onToggle(brand.id)}
                />
                <span className="min-w-0 flex-1 truncate text-foreground">{brand.name}</span>
                <BrandMark brand={brand} />
              </label>
            </li>
          ))}
        </ul>
      )}
    </ShowMoreList>
  );
}
