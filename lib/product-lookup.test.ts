import { describe, expect, it } from "vitest";
import { products } from "@/prisma/seed-data/products";
import { resolveProduct, resolveProducts } from "./product-lookup";

const first = products[0];
const second = products[1];

describe("resolveProduct", () => {
  it("resolves a known id with its brand and category names", () => {
    const resolved = resolveProduct(first.id, "uz");
    expect(resolved?.product.id).toBe(first.id);
    expect(resolved?.brandName.length).toBeGreaterThan(0);
    expect(resolved?.categoryName.length).toBeGreaterThan(0);
  });

  it("localizes the category name", () => {
    const uz = resolveProduct(first.id, "uz");
    const en = resolveProduct(first.id, "en");
    expect(uz?.categoryName).not.toBe(en?.categoryName);
  });

  it("returns null for an unknown id", () => {
    expect(resolveProduct("does-not-exist", "uz")).toBeNull();
  });
});

describe("resolveProducts", () => {
  it("preserves the order of the given ids", () => {
    const resolved = resolveProducts([second.id, first.id], "uz");
    expect(resolved.map((entry) => entry.product.id)).toEqual([second.id, first.id]);
  });

  it("silently drops ids that are no longer in the catalog", () => {
    const resolved = resolveProducts([first.id, "stale-id", second.id], "uz");
    expect(resolved.map((entry) => entry.product.id)).toEqual([first.id, second.id]);
  });

  it("returns an empty array for an empty list", () => {
    expect(resolveProducts([], "uz")).toEqual([]);
  });
});
