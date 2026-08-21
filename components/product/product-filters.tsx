"use client";

import type { ReactNode } from "react";
import type { Brand, Category } from "@/lib/types";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { AvailabilityFilter } from "@/lib/filters";
import type { Locale } from "@/lib/i18n/locales";
import type { CatalogFilters } from "@/lib/catalog-filters";
import { hasActiveFilters } from "@/lib/catalog-filters";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * One filter group: an eyebrow and its control.
 *
 * The eyebrow is the panel's own kicker — mono, uppercase, wide-tracked — and
 * it earns its place here because a sidebar of six stacked controls with no
 * hierarchy is a wall. Each group is a scannable heading, not decoration.
 */
function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="type-eyebrow text-muted">{label}</h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}

/**
 * Availability as a visible list rather than a fourth dropdown.
 *
 * It is the filter a mechanic reaches for first — "can I have it this week" —
 * and it is the only one whose options are a short, fixed set. Four radios
 * cost four lines of sidebar and remove a click from the most common
 * narrowing on the page. Brand and category stay as selects because their
 * lists grow with the catalog and would run off the screen.
 */
function AvailabilityChoice({
  value,
  onChange,
  dict,
  stockDict,
}: {
  value: AvailabilityFilter;
  onChange: (value: AvailabilityFilter) => void;
  dict: Dictionary["catalog"];
  stockDict: Dictionary["common"]["stock"];
}) {
  const options: { value: AvailabilityFilter; label: string }[] = [
    { value: "all", label: dict.allAvailability },
    { value: "available", label: stockDict.available },
    { value: "limited", label: stockDict.limited },
    { value: "out_of_stock", label: stockDict.outOfStock },
  ];

  return (
    <div role="radiogroup" aria-label={dict.filterAvailabilityLabel} className="flex flex-col">
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              // The 2px rail is the field treatment used across this codebase;
              // reusing it here means a selected filter and a focused input
              // speak the same visual language.
              "flex items-center border-l-2 py-1.5 pl-4 text-left text-sm transition-colors",
              selected
                ? "border-accent-strong font-medium text-foreground"
                : "border-border text-muted hover:border-border-strong hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export interface ProductFiltersProps {
  dict: Dictionary["catalog"];
  stockDict: Dictionary["common"]["stock"];
  brands: Brand[];
  categories: Category[];
  lang: Locale;
  filters: CatalogFilters;
  onChange: <K extends keyof CatalogFilters>(key: K, value: CatalogFilters[K]) => void;
  onClear: () => void;
  className?: string;
}

/**
 * The catalog's filter panel.
 *
 * Renders as a plain stack of groups and knows nothing about where it sits —
 * the sidebar on a desktop, a drawer on a phone — so both get exactly the same
 * controls rather than a full set and a reduced one.
 */
export function ProductFilters({
  dict,
  stockDict,
  brands,
  categories,
  lang,
  filters,
  onChange,
  onClear,
  className,
}: ProductFiltersProps) {
  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <Group label={dict.searchLabel}>
        <Input
          value={filters.search}
          onChange={(event) => onChange("search", event.target.value)}
          placeholder={dict.searchPlaceholder}
          aria-label={dict.searchLabel}
        />
      </Group>

      <Group label={dict.filterBrandLabel}>
        <Select
          value={filters.brandId}
          onChange={(event) => onChange("brandId", event.target.value)}
          aria-label={dict.filterBrandLabel}
        >
          <option value="all">{dict.allBrands}</option>
          {brands.map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.name}
            </option>
          ))}
        </Select>
      </Group>

      <Group label={dict.filterCategoryLabel}>
        <Select
          value={filters.categoryId}
          onChange={(event) => onChange("categoryId", event.target.value)}
          aria-label={dict.filterCategoryLabel}
        >
          <option value="all">{dict.allCategories}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name[lang]}
            </option>
          ))}
        </Select>
      </Group>

      <Group label={dict.filterAvailabilityLabel}>
        <AvailabilityChoice
          value={filters.availability}
          onChange={(value) => onChange("availability", value)}
          dict={dict}
          stockDict={stockDict}
        />
      </Group>

      {hasActiveFilters(filters) ? (
        <button
          type="button"
          onClick={onClear}
          className="self-start text-sm text-accent-strong transition-opacity hover:underline"
        >
          {dict.filtersReset}
        </button>
      ) : null}
    </div>
  );
}
