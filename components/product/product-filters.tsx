"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Icon } from "@/components/ui/icon";
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
 * One filter group: a heading that opens and closes, and its control.
 *
 * `<details>` rather than a state hook and a div. It is the element that means
 * this, it is keyboard-operable and announced correctly without a line of ARIA,
 * and — the reason that matters here — its contents are findable by the
 * browser's own find-in-page even while collapsed.
 *
 * Every group opens by default. A panel that arrives shut hides the fact that
 * there are filters at all, which is the opposite of the problem the sidebar
 * exists to solve; being able to shut the ones you are done with is what the
 * accordion buys, on a rail where the brand list runs long.
 *
 * The eyebrow is the panel's own kicker — mono, uppercase, wide-tracked — and
 * it earns its place because a stack of six controls with no hierarchy is a
 * wall.
 */
function Group({
  label,
  toggleLabel,
  children,
}: {
  label: string;
  /** Sentence for the summary, e.g. "Expand or collapse Brand". */
  toggleLabel: string;
  children: ReactNode;
}) {
  return (
    <details open className="group/filter border-b border-border pb-4 last:border-b-0">
      <summary
        title={toggleLabel}
        className="flex cursor-pointer list-none items-center justify-between rounded-sm py-1 [&::-webkit-details-marker]:hidden"
      >
        <h3 className="type-eyebrow text-muted transition-colors group-open/filter:text-foreground">
          {label}
        </h3>
        <Icon
          icon={ChevronDown}
          size="xs"
          aria-hidden
          className="text-muted transition-transform duration-200 group-open/filter:rotate-180"
        />
      </summary>
      <div className="mt-3">{children}</div>
    </details>
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
    <div className={cn("flex flex-col gap-4", className)}>
      <Group
        label={dict.searchLabel}
        toggleLabel={dict.filterGroupToggle.replace("{label}", dict.searchLabel)}
      >
        <Input
          value={filters.search}
          onChange={(event) => onChange("search", event.target.value)}
          placeholder={dict.searchPlaceholder}
          aria-label={dict.searchLabel}
        />
      </Group>

      <Group
        label={dict.filterBrandLabel}
        toggleLabel={dict.filterGroupToggle.replace("{label}", dict.filterBrandLabel)}
      >
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

      <Group
        label={dict.filterCategoryLabel}
        toggleLabel={dict.filterGroupToggle.replace("{label}", dict.filterCategoryLabel)}
      >
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

      <Group
        label={dict.filterAvailabilityLabel}
        toggleLabel={dict.filterGroupToggle.replace("{label}", dict.filterAvailabilityLabel)}
      >
        <AvailabilityChoice
          value={filters.availability}
          onChange={(value) => onChange("availability", value)}
          dict={dict}
          stockDict={stockDict}
        />
      </Group>

      {/*
        The reset lives here as well as in the chip row above the grid, because
        the drawer on a phone covers that row completely: a visitor who has just
        set four filters in the drawer must be able to undo them without
        dismissing it first.
      */}
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
