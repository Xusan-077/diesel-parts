import { describe, expect, it } from "vitest";
import { products } from "@/lib/data/products";
import { filterProducts, sortProducts } from "./filters";

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
    expect(result[0].oemNumber).toBe("127-8213");
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
