"use client";

import { Search } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { controlVariants } from "@/components/ui/field-styles";
import type { AvailabilityFilter } from "@/lib/filters";
import type { CatalogFilters } from "@/lib/catalog-filters";
import { hasActiveFilters, toggleBrand } from "@/lib/catalog-filters";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import type { Brand, Category } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BrandFilter } from "./brand-filter";
import { CategoryTreeFilter } from "./category-tree-filter";
import { FilterSection, filterRowClass } from "./filter-section";
import { PriceFilter, type PriceBounds } from "./price-filter";

/**
 * Availability as a visible list rather than a control to open.
 *
 * It is the filter a mechanic reaches for first — "can I have it this week" —
 * and it is the only one whose options are a short, fixed set. Four rows cost
 * four lines of sidebar and remove a click from the most common narrowing on
 * the page.
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
    <div role="radiogroup" aria-label={dict.filterAvailabilityLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={filterRowClass(value === option.value, "w-full")}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export interface ProductFiltersProps {
  dict: Dictionary["catalog"];
  stockDict: Dictionary["common"]["stock"];
  brands: Brand[];
  categories: Category[];
  /** The catalog's real price range, or null when nothing is priced yet. */
  priceBounds: PriceBounds | null;
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
 * the sidebar on a desktop, a sheet on a phone — so both get exactly the same
 * controls rather than a full set and a reduced one.
 *
 * Nothing here has an "apply" step. Every control writes straight to the filter
 * state and the grid catches up a beat later, so the panel is a reading of what
 * is on screen rather than a form to fill in and submit.
 */
export function ProductFilters({
  dict,
  stockDict,
  brands,
  categories,
  priceBounds,
  lang,
  filters,
  onChange,
  onClear,
  className,
}: ProductFiltersProps) {
  const toggle = (label: string) => dict.filterGroupToggle.replace("{label}", label);

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Outside the accordion: it is the one control that is faster to use
          than to find, and a shut group would hide the part number box. */}
      <div className="relative pb-3">
        <Icon
          icon={Search}
          size="xs"
          className="pointer-events-none absolute left-3 top-4.5 -translate-y-1/2 text-muted"
        />
        <input
          type="search"
          value={filters.search}
          onChange={(event) => onChange("search", event.target.value)}
          placeholder={dict.searchPlaceholder}
          aria-label={dict.searchLabel}
          // `text-base` below `lg`: this panel is a bottom sheet on a phone
          // (see FilterDrawer), and a sub-16px input there makes iOS Safari
          // zoom the page in on focus. The sidebar copy above `lg` keeps the
          // panel's usual `text-sm`, where there is no touch zoom to guard.
          className={cn(controlVariants({ variant: "box" }), "h-9 pl-8 text-base lg:text-sm")}
        />
      </div>

      <FilterSection label={dict.filterCategoryLabel} toggleLabel={toggle(dict.filterCategoryLabel)}>
        <CategoryTreeFilter
          categories={categories}
          lang={lang}
          value={filters.categoryId}
          onChange={(categoryId) => onChange("categoryId", categoryId)}
          dict={dict}
        />
      </FilterSection>

      {/* Dropped entirely when nothing is priced: a slider whose two ends mean
          the same thing is a control that cannot be got wrong or right. */}
      {priceBounds ? (
        <FilterSection label={dict.filterPriceLabel} toggleLabel={toggle(dict.filterPriceLabel)}>
          <PriceFilter
            bounds={priceBounds}
            min={filters.priceMin}
            max={filters.priceMax}
            onChange={(min, max) => {
              onChange("priceMin", min);
              onChange("priceMax", max);
            }}
            lang={lang}
            dict={dict}
          />
        </FilterSection>
      ) : null}

      <FilterSection label={dict.filterBrandLabel} toggleLabel={toggle(dict.filterBrandLabel)}>
        <BrandFilter
          brands={brands}
          value={filters.brandIds}
          onToggle={(brandId) => onChange("brandIds", toggleBrand(filters.brandIds, brandId))}
          dict={dict}
        />
      </FilterSection>

      <FilterSection
        label={dict.filterAvailabilityLabel}
        toggleLabel={toggle(dict.filterAvailabilityLabel)}
      >
        <AvailabilityChoice
          value={filters.availability}
          onChange={(value) => onChange("availability", value)}
          dict={dict}
          stockDict={stockDict}
        />
      </FilterSection>

      {/*
        The reset lives here as well as in the chip row above the grid, because
        the sheet on a phone covers that row completely: a visitor who has just
        set four filters in the sheet must be able to undo them without
        dismissing it first.
      */}
      {hasActiveFilters(filters) ? (
        <button
          type="button"
          onClick={onClear}
          className="mt-3 self-start text-sm text-accent-strong transition-opacity hover:underline"
        >
          {dict.filtersReset}
        </button>
      ) : null}
    </div>
  );
}
