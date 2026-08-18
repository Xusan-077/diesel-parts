import { describe, expect, it } from "vitest";
import { categories } from "@/prisma/seed-data/categories";
import { catalogGroups } from "@/lib/data/catalog-menu";
import { SUPPORTED_LOCALES } from "@/lib/i18n/locales";
import {
  categoryIdsForGroup,
  findGroupBySlug,
  findSubcategoryBySlug,
  resolveCatalogScope,
} from "./catalog-menu";

const allSubcategories = catalogGroups.flatMap((group) => group.subcategories);

describe("catalog menu data", () => {
  it("has unique group slugs and unique subcategory slugs across groups", () => {
    const groupSlugs = catalogGroups.map((group) => group.slug);
    expect(new Set(groupSlugs).size).toBe(groupSlugs.length);

    const subSlugs = allSubcategories.map((subcategory) => subcategory.slug);
    expect(new Set(subSlugs).size).toBe(subSlugs.length);
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
});

describe("findGroupBySlug / findSubcategoryBySlug", () => {
  it("finds a known group", () => {
    expect(findGroupBySlug("dvigatel-va-komponentlari")?.id).toBe("engine");
  });

  it("finds a subcategory nested in any group", () => {
    expect(findSubcategoryBySlug("forsunkalar")?.categoryId).toBe("injector");
  });

  it("returns undefined for unknown slugs", () => {
    expect(findGroupBySlug("nope")).toBeUndefined();
    expect(findSubcategoryBySlug("nope")).toBeUndefined();
  });
});

describe("categoryIdsForGroup", () => {
  it("collects only the mapped category ids", () => {
    const engine = findGroupBySlug("dvigatel-va-komponentlari")!;
    expect(categoryIdsForGroup(engine).sort()).toEqual(
      ["engine-parts", "injector", "piston", "turbocharger"].sort()
    );
  });

  it("returns an empty array when nothing in the group is mapped yet", () => {
    const brakes = findGroupBySlug("tormoz-tizimi")!;
    expect(categoryIdsForGroup(brakes)).toEqual([]);
  });
});

describe("resolveCatalogScope", () => {
  it("resolves a group to all of its mapped category ids", () => {
    const scope = resolveCatalogScope({ group: "transmissiya-kpp" });
    expect(scope?.categoryIds).toEqual(["transmission"]);
    expect(scope?.label.uz).toBe("Transmissiya KPP");
  });

  it("resolves a mapped subcategory to a single category id", () => {
    expect(resolveCatalogScope({ category: "porshen-guruhi" })?.categoryIds).toEqual(["piston"]);
  });

  it("resolves an unmapped subcategory to an empty scope rather than to everything", () => {
    const scope = resolveCatalogScope({ category: "antifriz" });
    expect(scope).not.toBeNull();
    expect(scope?.categoryIds).toEqual([]);
  });

  it("prefers group over category when both are given", () => {
    const scope = resolveCatalogScope({ group: "transmissiya-kpp", category: "antifriz" });
    expect(scope?.label.en).toBe("Transmission");
  });

  it("returns null for missing or unknown slugs", () => {
    expect(resolveCatalogScope({})).toBeNull();
    expect(resolveCatalogScope({ group: "nope" })).toBeNull();
    expect(resolveCatalogScope({ category: "nope" })).toBeNull();
  });
});
