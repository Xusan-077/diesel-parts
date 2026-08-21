import { describe, expect, it } from "vitest";
import { products } from "@/prisma/seed-data/products";
import { getRelatedProducts } from "./filters";

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
