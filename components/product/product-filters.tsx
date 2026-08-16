"use client";

import type { Brand, Category } from "@/lib/types";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { AvailabilityFilter, SortKey } from "@/lib/filters";
import type { Locale } from "@/lib/i18n/locales";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const SELECT_CLASS =
  "h-10 rounded-md border border-border bg-transparent px-3 text-sm text-foreground focus:border-accent-strong";

interface ProductFiltersProps {
  dict: Dictionary["catalog"];
  stockDict: Dictionary["common"]["stock"];
  brands: Brand[];
  categories: Category[];
  lang: Locale;
  search: string;
  onSearchChange: (value: string) => void;
  brandId: string;
  onBrandChange: (value: string) => void;
  categoryId: string;
  onCategoryChange: (value: string) => void;
  availability: AvailabilityFilter;
  onAvailabilityChange: (value: AvailabilityFilter) => void;
  sortKey: SortKey;
  onSortChange: (value: SortKey) => void;
  view: "grid" | "list";
  onViewChange: (value: "grid" | "list") => void;
}

export function ProductFilters({
  dict,
  stockDict,
  brands,
  categories,
  lang,
  search,
  onSearchChange,
  brandId,
  onBrandChange,
  categoryId,
  onCategoryChange,
  availability,
  onAvailabilityChange,
  sortKey,
  onSortChange,
  view,
  onViewChange,
}: ProductFiltersProps) {
  return (
    <div className="flex flex-col gap-4">
      <Input
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={dict.searchPlaceholder}
      />

      <div className="flex flex-wrap items-center gap-3">
        <select className={SELECT_CLASS} value={brandId} onChange={(event) => onBrandChange(event.target.value)}>
          <option value="all">{dict.allBrands}</option>
          {brands.map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.name}
            </option>
          ))}
        </select>

        <select
          className={SELECT_CLASS}
          value={categoryId}
          onChange={(event) => onCategoryChange(event.target.value)}
        >
          <option value="all">{dict.allCategories}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name[lang]}
            </option>
          ))}
        </select>

        <select
          className={SELECT_CLASS}
          value={availability}
          onChange={(event) => onAvailabilityChange(event.target.value as AvailabilityFilter)}
        >
          <option value="all">{dict.allAvailability}</option>
          <option value="available">{stockDict.available}</option>
          <option value="limited">{stockDict.limited}</option>
          <option value="out_of_stock">{stockDict.outOfStock}</option>
        </select>

        <select
          className={SELECT_CLASS}
          value={sortKey}
          onChange={(event) => onSortChange(event.target.value as SortKey)}
        >
          <option value="newest">{dict.sortNewest}</option>
          <option value="name-asc">{dict.sortNameAsc}</option>
          <option value="name-desc">{dict.sortNameDesc}</option>
        </select>

        <div className="ml-auto flex items-center gap-1 rounded-md border border-border p-1">
          <button
            type="button"
            aria-label={dict.gridView}
            onClick={() => onViewChange("grid")}
            className={cn("rounded px-3 py-1 text-xs", view === "grid" ? "bg-accent text-accent-foreground" : "text-muted")}
          >
            {dict.gridView}
          </button>
          <button
            type="button"
            aria-label={dict.listView}
            onClick={() => onViewChange("list")}
            className={cn("rounded px-3 py-1 text-xs", view === "list" ? "bg-accent text-accent-foreground" : "text-muted")}
          >
            {dict.listView}
          </button>
        </div>
      </div>
    </div>
  );
}
