import { describe, expect, it } from "vitest";
import {
  activeFilterCount,
  clearFilters,
  DEFAULT_FILTERS,
  hasActiveFilters,
  type CatalogFilters,
} from "./catalog-filters";

function withFilters(patch: Partial<CatalogFilters>): CatalogFilters {
  return { ...DEFAULT_FILTERS, ...patch };
}

describe("activeFilterCount", () => {
  it("counts nothing on a fresh catalog", () => {
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
  });

  it("counts each narrowed filter once", () => {
    expect(activeFilterCount(withFilters({ brandId: "cat" }))).toBe(1);
    expect(activeFilterCount(withFilters({ brandId: "cat", availability: "available" }))).toBe(2);
    expect(
      activeFilterCount(
        withFilters({
          search: "turbo",
          brandId: "cat",
          categoryId: "injector",
          availability: "limited",
        })
      )
    ).toBe(4);
  });

  it("ignores a search of nothing but whitespace", () => {
    expect(activeFilterCount(withFilters({ search: "   " }))).toBe(0);
  });
});

describe("hasActiveFilters", () => {
  it("is false by default and true once anything narrows", () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
    expect(hasActiveFilters(withFilters({ categoryId: "injector" }))).toBe(true);
  });
});

describe("clearFilters", () => {
  it("resets the selects", () => {
    const cleared = clearFilters(
      withFilters({ brandId: "cat", categoryId: "injector", availability: "limited" })
    );
    expect(cleared.brandId).toBe("all");
    expect(cleared.categoryId).toBe("all");
    expect(cleared.availability).toBe("all");
  });

  it("keeps the search the visitor typed", () => {
    expect(clearFilters(withFilters({ search: "127-8213", brandId: "cat" })).search).toBe(
      "127-8213"
    );
  });

  it("leaves an already-clear catalog at one active filter when only search is set", () => {
    expect(activeFilterCount(clearFilters(withFilters({ search: "turbo" })))).toBe(1);
  });
});
