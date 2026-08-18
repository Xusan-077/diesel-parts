import { describe, expect, it } from "vitest";
import { products } from "@/prisma/seed-data/products";
import { filterProducts, sortProducts, getRelatedProducts } from "./filters";

describe("filterProducts", () => {
  it("returns all products with no filters", () => {
    expect(filterProducts(products, {}, "en")).toHaveLength(products.length);
  });

  it("filters by search matching product name", () => {
    const result = filterProducts(products, { search: "turbocharger" }, "en");
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((p) => p.name.en.toLowerCase().includes("turbocharger"))).toBe(true);
  });

  it("filters by search matching SKU", () => {
    const result = filterProducts(products, { search: "DP-INJ-3126" }, "en");
    expect(result).toHaveLength(1);
    expect(result[0].sku).toBe("DP-INJ-3126");
  });

  it("filters by search matching OEM number", () => {
    const result = filterProducts(products, { search: "127-8213" }, "en");
    expect(result).toHaveLength(1);
    expect(result[0].oemNumbers).toEqual(["127-8213"]);
  });

  it("filters by a list of category ids", () => {
    const result = filterProducts(products, { categoryIds: ["injector", "piston"] }, "en");
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((p) => ["injector", "piston"].includes(p.categoryId))).toBe(true);
  });

  it("matches nothing for an empty category id list", () => {
    expect(filterProducts(products, { categoryIds: [] }, "en")).toHaveLength(0);
  });

  it("ignores an undefined category id list", () => {
    expect(filterProducts(products, { categoryIds: undefined }, "en")).toHaveLength(products.length);
  });

  it("filters by brand", () => {
    const result = filterProducts(products, { brandId: "cat" }, "en");
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((p) => p.brandId === "cat")).toBe(true);
  });

  it("filters by category", () => {
    const result = filterProducts(products, { categoryId: "turbocharger" }, "en");
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((p) => p.categoryId === "turbocharger")).toBe(true);
  });

  it("filters by availability", () => {
    const result = filterProducts(products, { availability: "out_of_stock" }, "en");
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((p) => p.stockStatus === "out_of_stock")).toBe(true);
  });

  it("treats 'all' as no filter for brand, category, and availability", () => {
    const result = filterProducts(products, { brandId: "all", categoryId: "all", availability: "all" }, "en");
    expect(result).toHaveLength(products.length);
  });

  it("combines multiple filters", () => {
    const result = filterProducts(products, { brandId: "cat", categoryId: "turbocharger" }, "en");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("cat-turbo-c15");
  });

  it("matches a product by any of its OEM numbers, not just the first", () => {
    const product = products.find((candidate) => candidate.sku === "DP-INJ-3126");
    expect(product).toBeDefined();
    const extra = { ...product!, oemNumbers: ["127-8213", "OEM-ALT-999"] };

    const result = filterProducts([extra], { search: "OEM-ALT-999" }, "uz");

    expect(result).toHaveLength(1);
  });
});

describe("sortProducts", () => {
  it("sorts by name ascending", () => {
    const sorted = sortProducts(products, "name-asc", "en");
    const names = sorted.map((p) => p.name.en);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("sorts by name descending", () => {
    const sorted = sortProducts(products, "name-desc", "en");
    const names = sorted.map((p) => p.name.en);
    expect(names).toEqual([...names].sort((a, b) => b.localeCompare(a)));
  });

  it("leaves order unchanged for 'newest'", () => {
    const sorted = sortProducts(products, "newest", "en");
    expect(sorted.map((p) => p.id)).toEqual(products.map((p) => p.id));
  });

  it("does not mutate the input array", () => {
    const original = [...products];
    sortProducts(products, "name-asc", "en");
    expect(products).toEqual(original);
  });
});

describe("getRelatedProducts", () => {
  it("excludes the product itself", () => {
    const product = products[0];
    const related = getRelatedProducts(product, products, 10);
    expect(related.every((p) => p.id !== product.id)).toBe(true);
  });

  it("filters to same categoryId only", () => {
    const product = products[0];
    const related = getRelatedProducts(product, products, 10);
    expect(related.every((p) => p.categoryId === product.categoryId)).toBe(true);
  });

  it("caps results at count parameter", () => {
    const product = products[0];
    const related = getRelatedProducts(product, products, 2);
    expect(related.length).toBeLessThanOrEqual(2);
  });

  it("returns fewer than count when fewer matches exist", () => {
    const product = products[0];
    // All related products in same category (excluding itself)
    const allRelated = getRelatedProducts(product, products, 100);
    const limited = getRelatedProducts(product, products, 2);
    expect(limited.length).toBeLessThanOrEqual(allRelated.length);
  });

  it("returns empty array when no matches exist", () => {
    const product = products[0];
    // Create a scenario with no other products in the category by filtering
    const singleProduct = [product];
    const related = getRelatedProducts(product, singleProduct, 4);
    expect(related).toEqual([]);
  });

  it("uses default count of 4 when not specified", () => {
    const product = products[0];
    const related = getRelatedProducts(product, products);
    // Should be capped at 4 or less if fewer exist
    expect(related.length).toBeLessThanOrEqual(4);
  });

  it("returns products from same category excluding the product itself", () => {
    const product = products[0];
    const related = getRelatedProducts(product, products, 4);
    const sameCategory = products.filter(
      (p) => p.id !== product.id && p.categoryId === product.categoryId
    );
    // Should return up to 4 from the same category
    expect(related.length).toBeLessThanOrEqual(Math.min(4, sameCategory.length));
    // All returned should be from same category (verified in earlier tests too)
    expect(related.every((p) => p.categoryId === product.categoryId)).toBe(true);
  });
});
