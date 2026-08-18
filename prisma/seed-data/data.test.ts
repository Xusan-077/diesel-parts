import { describe, expect, it } from "vitest";
import { brands } from "./brands";
import { categories } from "./categories";
import { products } from "./products";
import { blogPosts } from "@/lib/data/blog";

function expectUniqueSlugs(items: { slug: string }[]) {
  const slugs = items.map((item) => item.slug);
  expect(new Set(slugs).size).toBe(slugs.length);
}

describe("mock data integrity", () => {
  it("has 7 brands with unique ids and slugs", () => {
    expect(brands).toHaveLength(7);
    expectUniqueSlugs(brands);
    expect(new Set(brands.map((b) => b.id)).size).toBe(brands.length);
  });

  it("has 10 categories with unique ids, slugs, and localized names", () => {
    expect(categories).toHaveLength(10);
    expectUniqueSlugs(categories);
    for (const category of categories) {
      expect(category.name.uz).toBeTruthy();
      expect(category.name.ru).toBeTruthy();
      expect(category.name.en).toBeTruthy();
    }
  });

  it("has 15 products with unique ids and slugs", () => {
    expect(products).toHaveLength(15);
    expectUniqueSlugs(products);
    expect(new Set(products.map((p) => p.id)).size).toBe(products.length);
  });

  it("every product references a real brand and category", () => {
    const brandIds = new Set(brands.map((b) => b.id));
    const categoryIds = new Set(categories.map((c) => c.id));
    for (const product of products) {
      expect(brandIds.has(product.brandId)).toBe(true);
      expect(categoryIds.has(product.categoryId)).toBe(true);
    }
  });

  it("every brand and category is used by at least one product", () => {
    const usedBrandIds = new Set(products.map((p) => p.brandId));
    const usedCategoryIds = new Set(products.map((p) => p.categoryId));
    for (const brand of brands) {
      expect(usedBrandIds.has(brand.id)).toBe(true);
    }
    for (const category of categories) {
      expect(usedCategoryIds.has(category.id)).toBe(true);
    }
  });

  it("every product has at least one compatible model, one spec, and one image label", () => {
    for (const product of products) {
      expect(product.compatibleModels.length).toBeGreaterThan(0);
      expect(product.specs.length).toBeGreaterThan(0);
      expect(product.imageLabels.length).toBeGreaterThan(0);
    }
  });

  it("has 3 blog posts with unique slugs and non-empty bodies in all locales", () => {
    expect(blogPosts).toHaveLength(3);
    expectUniqueSlugs(blogPosts);
    for (const post of blogPosts) {
      expect(post.body.uz.length).toBeGreaterThan(0);
      expect(post.body.ru.length).toBeGreaterThan(0);
      expect(post.body.en.length).toBeGreaterThan(0);
    }
  });
});
