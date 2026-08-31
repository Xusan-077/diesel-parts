import { describe, expect, it } from "vitest";
import { categories } from "@/lib/data/mock-catalog/categories";
import { SUPPORTED_LOCALES } from "@/lib/i18n/locales";
import { slugify } from "@/lib/catalog-tree";
import { CATALOG_ICON_KEYS, catalogGroups, isCatalogIconKey } from "./catalog-menu";

const allSubcategories = catalogGroups.flatMap((group) => group.subcategories);

/**
 * These are seed invariants, not menu behaviour: `prisma/seed.ts` turns this
 * file into Category rows, and every rule below is one the table would enforce
 * only by failing the seed halfway through.
 */
describe("catalog menu seed data", () => {
  it("has unique slugs across groups and subcategories alike", () => {
    // Both become rows in one table with a unique slug, so a group and a
    // subcategory colliding is as fatal as two groups colliding.
    const slugs = [
      ...catalogGroups.map((group) => group.slug),
      ...allSubcategories.map((subcategory) => subcategory.slug),
    ];

    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("keeps group ids clear of the product category ids they would collide with", () => {
    // A root is written under its own slug for exactly this reason — see
    // seedCatalogTree in prisma/seed.ts.
    const productCategoryIds = new Set(categories.map((category) => category.id));

    for (const group of catalogGroups) {
      expect(productCategoryIds.has(group.slug)).toBe(false);
    }
  });

  it("names every group and subcategory in all supported locales", () => {
    for (const group of catalogGroups) {
      for (const locale of SUPPORTED_LOCALES) {
        expect(group.name[locale].length).toBeGreaterThan(0);
      }
      expect(group.subcategories.length).toBeGreaterThan(0);
    }

    for (const subcategory of allSubcategories) {
      for (const locale of SUPPORTED_LOCALES) {
        expect(subcategory.name[locale].length).toBeGreaterThan(0);
      }
    }
  });

  it("only references category ids that exist in the product catalog", () => {
    const knownIds = new Set(categories.map((category) => category.id));

    for (const subcategory of allSubcategories) {
      if (subcategory.categoryId) {
        expect(knownIds.has(subcategory.categoryId)).toBe(true);
      }
    }
  });

  it("writes slugs the panel would produce from the same names", () => {
    for (const group of catalogGroups) {
      expect(slugify(group.slug)).toBe(group.slug);
    }

    for (const subcategory of allSubcategories) {
      expect(slugify(subcategory.slug)).toBe(subcategory.slug);
    }
  });

  it("names an icon the renderer knows for every subcategory", () => {
    for (const subcategory of allSubcategories) {
      expect(isCatalogIconKey(subcategory.icon)).toBe(true);
    }
  });

  it("lists every icon key exactly once", () => {
    expect(new Set(CATALOG_ICON_KEYS).size).toBe(CATALOG_ICON_KEYS.length);
  });
});
