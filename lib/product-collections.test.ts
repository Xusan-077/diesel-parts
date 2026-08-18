import { describe, expect, it } from "vitest";
import { products } from "@/prisma/seed-data/products";
import {
  HOME_ROW_SIZE,
  getBestSellerProducts,
  getNewProducts,
  getPopularProducts,
} from "./product-collections";

const selectors = {
  popular: getPopularProducts,
  new: getNewProducts,
  bestSellers: getBestSellerProducts,
};

describe.each(Object.entries(selectors))("%s selector", (_name, select) => {
  it("returns the requested number of products", () => {
    expect(select(products)).toHaveLength(HOME_ROW_SIZE);
    expect(select(products, 2)).toHaveLength(2);
  });

  it("never repeats a product within the row", () => {
    const ids = select(products).map((product) => product.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only returns products from the given catalog", () => {
    const known = new Set(products.map((product) => product.id));
    for (const product of select(products)) {
      expect(known.has(product.id)).toBe(true);
    }
  });

  it("never returns more than the catalog holds", () => {
    expect(select(products.slice(0, 2), HOME_ROW_SIZE)).toHaveLength(2);
  });

  it("returns nothing for an empty catalog", () => {
    expect(select([])).toEqual([]);
  });
});

describe("getNewProducts", () => {
  it("puts the newest (last in catalog order) first", () => {
    expect(getNewProducts(products, 2)[0].id).toBe(products[products.length - 1].id);
  });
});

describe("getBestSellerProducts", () => {
  it("prefers in-stock products", () => {
    const availableCount = products.filter((p) => p.stockStatus === "available").length;
    const picked = getBestSellerProducts(products, Math.min(availableCount, HOME_ROW_SIZE));
    expect(picked.every((product) => product.stockStatus === "available")).toBe(true);
  });

  it("falls back to out-of-stock items once in-stock ones run out", () => {
    const outOfStock = products.filter((p) => p.stockStatus !== "available").slice(0, 1);
    expect(getBestSellerProducts(outOfStock, 1)).toEqual(outOfStock);
  });
});

describe("row overlap", () => {
  it("popular and new rows do not show an identical set", () => {
    const popular = getPopularProducts(products).map((p) => p.id);
    const fresh = getNewProducts(products).map((p) => p.id);
    expect(popular).not.toEqual(fresh);
  });
});
