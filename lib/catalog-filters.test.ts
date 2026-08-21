import { describe, expect, it } from "vitest";
import {
  activeFilterCount,
  clearedValue,
  clearFilters,
  DEFAULT_FILTERS,
  describeActiveFilters,
  hasActiveFilters,
  type CatalogFilters,
  type FilterChipLabels,
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

const LABELS: FilterChipLabels = {
  search: "Qidiruv",
  brand: "Brend",
  category: "Kategoriya",
  availability: "Mavjudlik",
  brandName: (id) => (id === "cat" ? "CAT" : ""),
  categoryName: (id) => (id === "injector" ? "Forsunka" : ""),
  availabilityName: (value) => (value === "available" ? "Mavjud" : String(value)),
};

describe("describeActiveFilters", () => {
  it("says nothing about a catalog nobody has narrowed", () => {
    expect(describeActiveFilters(DEFAULT_FILTERS, LABELS)).toEqual([]);
  });

  it("names what was filtered on and what it was set to", () => {
    expect(describeActiveFilters(withFilters({ brandId: "cat" }), LABELS)).toEqual([
      { key: "brandId", label: "Brend", value: "CAT" },
    ]);
  });

  it("describes every narrowed filter, in panel order", () => {
    const chips = describeActiveFilters(
      withFilters({
        search: "3126",
        brandId: "cat",
        categoryId: "injector",
        availability: "available",
      }),
      LABELS
    );

    expect(chips.map((chip) => chip.key)).toEqual([
      "search",
      "brandId",
      "categoryId",
      "availability",
    ]);
    expect(chips.map((chip) => chip.value)).toEqual([
      "3126",
      "CAT",
      "Forsunka",
      "Mavjud",
    ]);
  });

  it("shows the query as typed, minus the whitespace around it", () => {
    const [chip] = describeActiveFilters(withFilters({ search: "  3126  " }), LABELS);
    expect(chip.value).toBe("3126");
  });

  it("treats a search of nothing but spaces as no search", () => {
    expect(describeActiveFilters(withFilters({ search: "   " }), LABELS)).toEqual([]);
  });

  it("drops a filter whose row has since been deleted", () => {
    // A chip reading "Brend:" with nothing after it cannot be understood; the
    // panel can still clear the stale id.
    expect(describeActiveFilters(withFilters({ brandId: "gone" }), LABELS)).toEqual([]);
  });

  it("agrees with the count the mobile badge shows", () => {
    const filters = withFilters({ brandId: "cat", availability: "available" });
    expect(describeActiveFilters(filters, LABELS)).toHaveLength(
      activeFilterCount(filters)
    );
  });
});

describe("clearedValue", () => {
  it("turns each filter off the way its own default does", () => {
    expect(clearedValue("search")).toBe("");
    expect(clearedValue("brandId")).toBe("all");
    expect(clearedValue("categoryId")).toBe("all");
    expect(clearedValue("availability")).toBe("all");
  });

  it("leaves no chip behind when applied to a described filter", () => {
    const filters = withFilters({ brandId: "cat" });
    const cleared = { ...filters, brandId: clearedValue("brandId") };
    expect(describeActiveFilters(cleared, LABELS)).toEqual([]);
  });
});
