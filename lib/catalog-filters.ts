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
