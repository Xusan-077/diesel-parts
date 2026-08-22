import { describe, expect, it } from "vitest";
import {
  activeFilterCount,
  clearFilters,
  DEFAULT_FILTERS,
  describeActiveFilters,
  hasActiveFilters,
  removeFilter,
  toggleBrand,
  type CatalogFilters,
  type FilterChipLabels,
} from "./catalog-filters";

function withFilters(patch: Partial<CatalogFilters>): CatalogFilters {
  return { ...DEFAULT_FILTERS, ...patch };
}

describe("toggleBrand", () => {
  it("ticks a brand that was not ticked", () => {
    expect(toggleBrand([], "cat")).toEqual(["cat"]);
  });

  it("unticks one that was, leaving the others standing", () => {
    expect(toggleBrand(["cat", "volvo"], "cat")).toEqual(["volvo"]);
  });

  it("keeps the order the reader ticked them in", () => {
    expect(toggleBrand(["volvo"], "cat")).toEqual(["volvo", "cat"]);
  });
});

describe("activeFilterCount", () => {
  it("counts nothing on a fresh catalog", () => {
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
  });

  it("counts each narrowed filter once", () => {
    expect(activeFilterCount(withFilters({ brandIds: ["cat"] }))).toBe(1);
    expect(
      activeFilterCount(withFilters({ brandIds: ["cat"], availability: "available" }))
    ).toBe(2);
    expect(
      activeFilterCount(
        withFilters({
          search: "turbo",
          brandIds: ["cat"],
          categoryId: "injector",
          availability: "limited",
        })
      )
    ).toBe(4);
  });

  it("counts each ticked brand, because each is a narrowing the reader made", () => {
    expect(activeFilterCount(withFilters({ brandIds: ["cat", "volvo", "jcb"] }))).toBe(3);
  });

  it("counts a price range once, however many ends were moved", () => {
    expect(activeFilterCount(withFilters({ priceMin: 500_000 }))).toBe(1);
    expect(activeFilterCount(withFilters({ priceMin: 500_000, priceMax: 2_000_000 }))).toBe(1);
  });

  it("ignores a search of nothing but whitespace", () => {
    expect(activeFilterCount(withFilters({ search: "   " }))).toBe(0);
  });
});

describe("hasActiveFilters", () => {
  it("is false by default and true once anything narrows", () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
    expect(hasActiveFilters(withFilters({ categoryId: "injector" }))).toBe(true);
    expect(hasActiveFilters(withFilters({ priceMax: 2_000_000 }))).toBe(true);
  });
});

describe("clearFilters", () => {
  it("resets everything the reader picked from a list", () => {
    const cleared = clearFilters(
      withFilters({
        brandIds: ["cat", "volvo"],
        categoryId: "injector",
        availability: "limited",
        priceMin: 500_000,
        priceMax: 2_000_000,
      })
    );
    expect(cleared.brandIds).toEqual([]);
    expect(cleared.categoryId).toBe("all");
    expect(cleared.availability).toBe("all");
    expect(cleared.priceMin).toBeNull();
    expect(cleared.priceMax).toBeNull();
  });

  it("keeps the search the visitor typed", () => {
    expect(clearFilters(withFilters({ search: "127-8213", brandIds: ["cat"] })).search).toBe(
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
  price: "Narx",
  brandName: (id) => ({ cat: "CAT", volvo: "Volvo" })[id] ?? "",
  categoryName: (id) => (id === "injector" ? "Forsunka" : ""),
  availabilityName: (value) => (value === "available" ? "Mavjud" : String(value)),
  priceRange: (min, max) =>
    min !== null && max !== null ? `${min}–${max}` : min !== null ? `${min}+` : `<${max}`,
};

describe("describeActiveFilters", () => {
  it("says nothing about a catalog nobody has narrowed", () => {
    expect(describeActiveFilters(DEFAULT_FILTERS, LABELS)).toEqual([]);
  });

  it("names what was filtered on and what it was set to", () => {
    expect(describeActiveFilters(withFilters({ brandIds: ["cat"] }), LABELS)).toEqual([
      { key: "brandIds", id: "cat", label: "Brend", value: "CAT" },
    ]);
  });

  it("gives each ticked brand its own chip, so one can be dropped", () => {
    const chips = describeActiveFilters(withFilters({ brandIds: ["cat", "volvo"] }), LABELS);
    expect(chips.map((chip) => chip.value)).toEqual(["CAT", "Volvo"]);
    expect(chips.map((chip) => chip.id)).toEqual(["cat", "volvo"]);
  });

  it("describes every narrowed filter, in panel order", () => {
    const chips = describeActiveFilters(
      withFilters({
        search: "3126",
        brandIds: ["cat"],
        categoryId: "injector",
        availability: "available",
        priceMin: 500_000,
        priceMax: 2_000_000,
      }),
      LABELS
    );

    expect(chips.map((chip) => chip.key)).toEqual([
      "search",
      "brandIds",
      "categoryId",
      "priceMin",
      "availability",
    ]);
    expect(chips.map((chip) => chip.value)).toEqual([
      "3126",
      "CAT",
      "Forsunka",
      "500000–2000000",
      "Mavjud",
    ]);
  });

  it("describes a range with one open end without leaving a blank in it", () => {
    expect(describeActiveFilters(withFilters({ priceMin: 500_000 }), LABELS)[0].value).toBe(
      "500000+"
    );
    expect(describeActiveFilters(withFilters({ priceMax: 2_000_000 }), LABELS)[0].value).toBe(
      "<2000000"
    );
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
    expect(describeActiveFilters(withFilters({ brandIds: ["gone"] }), LABELS)).toEqual([]);
  });

  it("agrees with the count the mobile badge shows", () => {
    const filters = withFilters({ brandIds: ["cat", "volvo"], availability: "available" });
    expect(describeActiveFilters(filters, LABELS)).toHaveLength(activeFilterCount(filters));
  });
});

describe("removeFilter", () => {
  it("clears a single-value filter", () => {
    const filters = withFilters({ categoryId: "injector" });
    const [chip] = describeActiveFilters(filters, LABELS);
    expect(removeFilter(filters, chip).categoryId).toBe("all");
  });

  it("drops one brand and leaves the rest ticked", () => {
    const filters = withFilters({ brandIds: ["cat", "volvo"] });
    const [chip] = describeActiveFilters(filters, LABELS);
    expect(removeFilter(filters, chip).brandIds).toEqual(["volvo"]);
  });

  it("clears both ends of the price range from its one chip", () => {
    const filters = withFilters({ priceMin: 500_000, priceMax: 2_000_000 });
    const [chip] = describeActiveFilters(filters, LABELS);
    expect(removeFilter(filters, chip)).toMatchObject({ priceMin: null, priceMax: null });
  });

  it("leaves no chip behind for what it removed", () => {
    const filters = withFilters({ brandIds: ["cat"], search: "turbo" });
    const [, brandChip] = describeActiveFilters(filters, LABELS);
    const chips = describeActiveFilters(removeFilter(filters, brandChip), LABELS);
    expect(chips.map((chip) => chip.key)).toEqual(["search"]);
  });
});
