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
  brandId: string;
  categoryId: string;
  availability: AvailabilityFilter;
}

export const DEFAULT_FILTERS: CatalogFilters = {
  search: "",
  brandId: "all",
  categoryId: "all",
  availability: "all",
};

/** How many filters are narrowing the results. Drives the mobile badge. */
export function activeFilterCount(filters: CatalogFilters): number {
  let count = 0;
  if (filters.search.trim() !== "") count += 1;
  if (filters.brandId !== "all") count += 1;
  if (filters.categoryId !== "all") count += 1;
  if (filters.availability !== "all") count += 1;
  return count;
}

export function hasActiveFilters(filters: CatalogFilters): boolean {
  return activeFilterCount(filters) > 0;
}

/**
 * Clearing keeps the search box.
 *
 * The visitor typed that; the selects they merely picked from. Wiping a search
 * someone entered — often the part number they arrived with — is the one
 * "clear" that reads as data loss rather than as a reset.
 */
export function clearFilters(filters: CatalogFilters): CatalogFilters {
  return { ...DEFAULT_FILTERS, search: filters.search };
}

/**
 * One applied filter, as the chip row above the grid shows it.
 *
 * The chips exist because the panel is not always on screen — it is a drawer on
 * a phone, and on a desktop it is a rail the reader has scrolled past by the
 * time they are looking at page three. Without them, a short result list and a
 * heavily filtered one look identical, and the only way to find out which is to
 * go back and read four controls.
 */
export interface FilterChip {
  /** Which filter this came from; the key `onRemove` is called with. */
  key: keyof CatalogFilters;
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
  /** Resolves an id to the name a reader would recognise. */
  brandName: (id: string) => string;
  categoryName: (id: string) => string;
  availabilityName: (value: AvailabilityFilter) => string;
}

/**
 * Describes the filters that are actually narrowing the grid.
 *
 * A filter left at "all" is not a filter and gets no chip — a row of chips that
 * always says "Brand: all brands" tells the reader nothing and hides the two
 * that matter. An id whose row has since been deleted resolves to nothing and
 * is dropped for the same reason: a chip reading "Brend:" with an empty value
 * cannot be understood, though it can still be cleared from the panel.
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

  if (filters.brandId !== "all") {
    const name = labels.brandName(filters.brandId);
    if (name !== "") {
      chips.push({ key: "brandId", label: labels.brand, value: name });
    }
  }

  if (filters.categoryId !== "all") {
    const name = labels.categoryName(filters.categoryId);
    if (name !== "") {
      chips.push({ key: "categoryId", label: labels.category, value: name });
    }
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
 * The value that turns a filter off.
 *
 * Every filter but the search box is an id or an enum whose "off" is the string
 * "all"; the search box's is an empty string. Keeping that in one place is what
 * lets a chip's ✕ be a single call rather than a switch at the call site.
 */
export function clearedValue<K extends keyof CatalogFilters>(key: K): CatalogFilters[K] {
  return DEFAULT_FILTERS[key];
}
