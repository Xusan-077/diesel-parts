import { describe, expect, it } from "vitest";
import { buildProductWhere } from "./product-where";
import type { ProductQuery } from "./product-query";

function query(overrides: Partial<ProductQuery> = {}): ProductQuery {
  return {
    q: "",
    brandId: "all",
    categoryId: "all",
    categoryIds: undefined,
    availability: "all",
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
    expect(buildProductWhere(query({ brandId: "cat" })).where.brandId).toBe("cat");
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
