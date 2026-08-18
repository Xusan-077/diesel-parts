import { describe, expect, it, vi } from "vitest";
import { SUPPORTED_LOCALES } from "@/lib/i18n/locales";
import { blogPosts } from "@/lib/data/blog";

/*
 * The sitemap reads the catalog through the repository now, so the counts come
 * from these fixtures rather than from the seed arrays. Fixed fixtures also
 * make the assertions independent of how many products happen to be seeded.
 */
const PRODUCT_SLUGS = ["injector-a", "turbo-b"];
const CATEGORIES = [
  { id: "injector", slug: "injector", name: { uz: "Forsunka", ru: "Форсунка", en: "Injector" } },
];
const BRANDS = [{ id: "cat", slug: "cat", name: "CAT" }];

vi.mock("@/lib/api/product-repository", () => ({
  listProductSlugs: async () => PRODUCT_SLUGS,
  listCategories: async () => CATEGORIES,
  listBrands: async () => BRANDS,
}));

const { default: sitemap, STATIC_PATHS } = await import("./sitemap");

describe("sitemap", () => {
  it("includes one entry per locale for every static path, product, category, brand, and blog post", async () => {
    const entries = await sitemap();
    const expectedCount =
      SUPPORTED_LOCALES.length *
      (STATIC_PATHS.length +
        PRODUCT_SLUGS.length +
        CATEGORIES.length +
        BRANDS.length +
        blogPosts.length);
    expect(entries).toHaveLength(expectedCount);
  });

  it("produces only unique URLs", async () => {
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("includes a locale home page entry for every supported locale", async () => {
    const entries = await sitemap();
    const urls = new Set(entries.map((entry) => entry.url));
    for (const lang of SUPPORTED_LOCALES) {
      expect(urls.has(`https://dieselparts.uz/${lang}`)).toBe(true);
    }
  });

  it("includes every product detail URL for every locale", async () => {
    const entries = await sitemap();
    const urls = new Set(entries.map((entry) => entry.url));
    for (const lang of SUPPORTED_LOCALES) {
      for (const slug of PRODUCT_SLUGS) {
        expect(urls.has(`https://dieselparts.uz/${lang}/products/${slug}`)).toBe(true);
      }
    }
  });
});
