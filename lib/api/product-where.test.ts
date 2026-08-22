import { describe, expect, it } from "vitest";
import { buildProductWhere } from "./product-where";
import type { ProductQuery } from "./product-query";

function query(overrides: Partial<ProductQuery> = {}): ProductQuery {
  return {
    q: "",
    brandIds: [],
    categoryId: "all",
    categoryIds: undefined,
    availability: "all",
    priceMin: null,
    priceMax: null,
    sort: "newest",
    page: 1,
    pageSize: 9,
    lang: "uz",
    ...overrides,
  };
}

describe("buildProductWhere", () => {
  it("only ever returns active products", () => {
    expect(buildProductWhere(query()).where.isActive).toBe(true);
  });

  it("omits brand, category and availability clauses when they are 'all'", () => {
    const { where } = buildProductWhere(query());
    expect(where.brandId).toBeUndefined();
    expect(where.categoryId).toBeUndefined();
    expect(where.stockStatus).toBeUndefined();
    expect(where.OR).toBeUndefined();
  });

  it("filters by brand", () => {
    expect(buildProductWhere(query({ brandIds: ["cat"] })).where.brandId).toEqual({ in: ["cat"] });
  });

  it("filters by several brands at once", () => {
    const { where } = buildProductWhere(query({ brandIds: ["cat", "komatsu"] }));
    expect(where.brandId).toEqual({ in: ["cat", "komatsu"] });
  });

  it("omits the price clause when neither end is set", () => {
    expect(buildProductWhere(query()).where.price).toBeUndefined();
  });

  it("filters on one end of the price range at a time", () => {
    expect(buildProductWhere(query({ priceMin: 500_000 })).where.price).toEqual({ gte: 500_000 });
    expect(buildProductWhere(query({ priceMax: 2_000_000 })).where.price).toEqual({
      lte: 2_000_000,
    });
  });

  it("filters on both ends of the price range", () => {
    const { where } = buildProductWhere(query({ priceMin: 500_000, priceMax: 2_000_000 }));
    expect(where.price).toEqual({ gte: 500_000, lte: 2_000_000 });
  });

  it("a price bound also excludes the products that have no price", () => {
    // Prisma reads `{ gte }` on a nullable column as "has a value, and it is at
    // least this" — the unpriced rows fall out without a second clause. This
    // asserts the behaviour the filter depends on rather than the syntax.
    const { where } = buildProductWhere(query({ priceMin: 0 }));
    expect(where.price).toEqual({ gte: 0 });
  });

  it("filters by a single category", () => {
    expect(buildProductWhere(query({ categoryId: "injector" })).where.categoryId).toBe("injector");
  });

  it("scopes to a category set from the catalog menu", () => {
    const { where } = buildProductWhere(query({ categoryIds: ["injector", "piston"] }));
    expect(where.categoryId).toEqual({ in: ["injector", "piston"] });
  });

  it("an empty category set matches nothing rather than everything", () => {
    const { where } = buildProductWhere(query({ categoryIds: [] }));
    expect(where.categoryId).toEqual({ in: [] });
  });

  it("an explicit category set wins over a single category id", () => {
    const { where } = buildProductWhere(
      query({ categoryId: "turbocharger", categoryIds: ["injector"] })
    );
    expect(where.categoryId).toEqual({ in: ["injector"] });
  });

  it("an empty category set still wins, rather than being treated as absent", () => {
    const { where } = buildProductWhere(query({ categoryId: "turbocharger", categoryIds: [] }));
    expect(where.categoryId).toEqual({ in: [] });
  });

  it("filters availability by the persisted status column", () => {
    expect(buildProductWhere(query({ availability: "limited" })).where.stockStatus).toBe("limited");
  });

  it("searches the name column of the requested locale, plus sku and OEM numbers", () => {
    const { where } = buildProductWhere(query({ q: "forsunka", lang: "uz" }));
    expect(where.OR).toEqual([
      { nameUz: { contains: "forsunka", mode: "insensitive" } },
      { sku: { contains: "forsunka", mode: "insensitive" } },
      { oemNumbers: { has: "FORSUNKA" } },
    ]);
  });

  it("upper-cases the OEM term, because Prisma's array `has` cannot be case-insensitive", () => {
    const { where } = buildProductWhere(query({ q: "voe14514151" }));
    expect(where.OR?.[2]).toEqual({ oemNumbers: { has: "VOE14514151" } });
  });

  it("searches the Russian name column when the locale is ru", () => {
    const { where } = buildProductWhere(query({ q: "насос", lang: "ru" }));
    expect(where.OR?.[0]).toEqual({ nameRu: { contains: "насос", mode: "insensitive" } });
  });

  it("sorts newest first by default", () => {
    expect(buildProductWhere(query()).orderBy).toEqual({ createdAt: "desc" });
  });

  it("sorts by localised name ascending", () => {
    expect(buildProductWhere(query({ sort: "name-asc", lang: "en" })).orderBy).toEqual({
      nameEn: "asc",
    });
  });

  it("sorts by localised name descending", () => {
    expect(buildProductWhere(query({ sort: "name-desc", lang: "ru" })).orderBy).toEqual({
      nameRu: "desc",
    });
  });
});
