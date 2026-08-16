import { describe, expect, it } from "vitest";
import sitemap, { STATIC_PATHS } from "./sitemap";
import { SUPPORTED_LOCALES } from "@/lib/i18n/locales";
import { products } from "@/lib/data/products";
import { categories } from "@/lib/data/categories";
import { brands } from "@/lib/data/brands";
import { blogPosts } from "@/lib/data/blog";

const STATIC_PATH_COUNT = STATIC_PATHS.length;

describe("sitemap", () => {
  it("includes one entry per locale for every static path, product, category, brand, and blog post", () => {
    const entries = sitemap();
    const expectedCount =
      SUPPORTED_LOCALES.length *
      (STATIC_PATH_COUNT + products.length + categories.length + brands.length + blogPosts.length);
    expect(entries).toHaveLength(expectedCount);
  });

  it("produces only unique URLs", () => {
    const entries = sitemap();
    const urls = entries.map((entry) => entry.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("includes a locale home page entry for every supported locale", () => {
    const entries = sitemap();
    const urls = new Set(entries.map((entry) => entry.url));
    for (const lang of SUPPORTED_LOCALES) {
      expect(urls.has(`https://dieselparts.uz/${lang}`)).toBe(true);
    }
  });

  it("includes every product detail URL for every locale", () => {
    const entries = sitemap();
    const urls = new Set(entries.map((entry) => entry.url));
    for (const lang of SUPPORTED_LOCALES) {
      for (const product of products) {
        expect(urls.has(`https://dieselparts.uz/${lang}/products/${product.slug}`)).toBe(true);
      }
    }
  });
});
