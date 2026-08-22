import type { AvailabilityFilter } from "@/lib/filters";

/**
 * The catalog's filter state, and the rules for reading it back.
 *
 * Sort and view are deliberately absent. They describe how the results are
 * *presented*, not which results there are, so they live in the toolbar above
 * the grid rather than in the filter panel — and "clear filters" must not
 * silently reset the reader's chosen sort order.
 */
export interface CatalogFilters {
  search: string;
  /**
   * Brands ticked in the sidebar. Empty means every brand: a checkbox list has
   * no "all" row to select, so absence is the only honest way to say it.
   */
  brandIds: string[];
  categoryId: string;
  availability: AvailabilityFilter;
  /** Price bounds in UZS. `null` on either end means the reader set no bound. */
  priceMin: number | null;
  priceMax: number | null;
}

export const DEFAULT_FILTERS: CatalogFilters = {
  search: "",
  brandIds: [],
  categoryId: "all",
  availability: "all",
  priceMin: null,
  priceMax: null,
};

/**
 * Adds or removes one brand.
 *
 * The order ticked is preserved rather than sorted, so the chip row above the
 * grid reads back in the order the reader built it.
 */
export function toggleBrand(brandIds: readonly string[], id: string): string[] {
  return brandIds.includes(id)
    ? brandIds.filter((current) => current !== id)
    : [...brandIds, id];
}

/**
 * How many filters are narrowing the results. Drives the mobile badge.
 *
 * Each ticked brand counts separately — the badge answers "how much have I
 * narrowed this", and three brands is three narrowings, not one.
 */
export function activeFilterCount(filters: CatalogFilters): number {
  let count = 0;
  if (filters.search.trim() !== "") count += 1;
  count += filters.brandIds.length;
  if (filters.categoryId !== "all") count += 1;
  if (filters.availability !== "all") count += 1;
  // A range is one narrowing however many ends the reader moved.
  if (filters.priceMin !== null || filters.priceMax !== null) count += 1;
  return count;
}

export function hasActiveFilters(filters: CatalogFilters): boolean {
  return activeFilterCount(filters) > 0;
}

/**
 * Clearing keeps the search box.
 *
 * The visitor typed that; the rest they merely picked from. Wiping a search
 * someone entered — often the part number they arrived with — is the one
 * "clear" that reads as data loss rather than as a reset.
 */
export function clearFilters(filters: CatalogFilters): CatalogFilters {
  return { ...DEFAULT_FILTERS, search: filters.search };
}

/**
 * One applied filter, as the chip row above the grid shows it.
 *
 * The chips exist because the panel is not always on screen — it is a sheet on
 * a phone, and on a desktop it is a rail the reader has scrolled past by the
 * time they are looking at page three. Without them, a short result list and a
 * heavily filtered one look identical, and the only way to find out which is to
 * go back and read six controls.
 */
export interface FilterChip {
  /** Which filter this came from; what `removeFilter` is told to clear. */
  key: keyof CatalogFilters;
  /**
   * The one value to drop, for a filter that holds several. Absent on a filter
   * that holds one, where removing the chip clears the whole thing.
   */
  id?: string;
  /** What was filtered on, e.g. "Brend". */
  label: string;
  /** What it was set to, e.g. "CAT". */
  value: string;
}

/** The labels a chip row needs, resolved by the caller from its own data. */
export interface FilterChipLabels {
  search: string;
  brand: string;
  category: string;
  availability: string;
  price: string;
  /** Resolves an id to the name a reader would recognise. */
  brandName: (id: string) => string;
  categoryName: (id: string) => string;
  availabilityName: (value: AvailabilityFilter) => string;
  /** Renders the range the reader set, e.g. "500 000 – 2 000 000 so'm". */
  priceRange: (min: number | null, max: number | null) => string;
}

/**
 * Describes the filters that are actually narrowing the grid.
 *
 * A filter left at "all" is not a filter and gets no chip — a row of chips that
 * always says "Brend: barcha brendlar" tells the reader nothing and hides the
 * two that matter. An id whose row has since been deleted resolves to nothing
 * and is dropped for the same reason: a chip reading "Brend:" with an empty
 * value cannot be understood, though it can still be cleared from the panel.
 */
export function describeActiveFilters(
  filters: CatalogFilters,
  labels: FilterChipLabels
): FilterChip[] {
  const chips: FilterChip[] = [];
  const search = filters.search.trim();

  if (search !== "") {
    chips.push({ key: "search", label: labels.search, value: search });
  }

  // One chip per brand rather than "Brend: CAT, Komatsu, Volvo": a combined
  // chip can only be removed whole, which is never what a reader wants when
  // they have ticked three and changed their mind about one.
  for (const id of filters.brandIds) {
    const name = labels.brandName(id);
    if (name !== "") {
      chips.push({ key: "brandIds", id, label: labels.brand, value: name });
    }
  }

  if (filters.categoryId !== "all") {
    const name = labels.categoryName(filters.categoryId);
    if (name !== "") {
      chips.push({ key: "categoryId", label: labels.category, value: name });
    }
  }

  if (filters.priceMin !== null || filters.priceMax !== null) {
    chips.push({
      key: "priceMin",
      label: labels.price,
      value: labels.priceRange(filters.priceMin, filters.priceMax),
    });
  }

  if (filters.availability !== "all") {
    chips.push({
      key: "availability",
      label: labels.availability,
      value: labels.availabilityName(filters.availability),
    });
  }

  return chips;
}

/**
 * The filter state with one chip's narrowing undone.
 *
 * Returns whole state rather than a per-key "off" value, because the two
 * filters that are not a single value cannot express theirs as one: dropping a
 * brand leaves the other brands standing, and clearing a price range clears
 * both ends from one chip.
 */
export function removeFilter(filters: CatalogFilters, chip: FilterChip): CatalogFilters {
  switch (chip.key) {
    case "brandIds":
      return {
        ...filters,
        brandIds: filters.brandIds.filter((id) => id !== chip.id),
      };
    case "priceMin":
    case "priceMax":
      return { ...filters, priceMin: null, priceMax: null };
    default:
      return { ...filters, [chip.key]: DEFAULT_FILTERS[chip.key] };
  }
}
