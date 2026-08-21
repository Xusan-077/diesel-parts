import { afterEach, describe, expect, it, vi } from "vitest";
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

/** Flipped by the outage test below; every other test reads the fixtures. */
let databaseReachable = true;

function read<T>(value: T): () => Promise<T> {
  return async () => {
    if (!databaseReachable) {
      throw new Error("Server has closed the connection");
    }
    return value;
  };
}

vi.mock("@/lib/api/product-repository", () => ({
  listProductSlugs: read(PRODUCT_SLUGS),
  listCategories: read(CATEGORIES),
  listBrands: read(BRANDS),
}));

afterEach(() => {
  databaseReachable = true;
  vi.restoreAllMocks();
});

const { default: sitemap, STATIC_PATHS } = await import("./sitemap");

describe("sitemap", () => {
  it("includes one entry per static path, product, category, brand, and blog post", async () => {
    const entries = await sitemap();
    const expectedCount =
      STATIC_PATHS.length +
      PRODUCT_SLUGS.length +
      CATEGORIES.length +
      BRANDS.length +
      blogPosts.length;
    expect(entries).toHaveLength(expectedCount);
  });

  it("produces only unique URLs", async () => {
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("includes the home page once", async () => {
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);
    expect(urls.filter((url) => url === "https://dieselparts.uz")).toHaveLength(1);
  });

  it("includes every product detail URL", async () => {
    const entries = await sitemap();
    const urls = new Set(entries.map((entry) => entry.url));
    for (const slug of PRODUCT_SLUGS) {
      expect(urls.has(`https://dieselparts.uz/products/${slug}`)).toBe(true);
    }
  });

  /*
   * A sitemap that 500s teaches a crawler the file is unreliable; a short one
   * it can re-read tomorrow does not.
   */
  it("still serves the static routes when the catalog cannot be read", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    databaseReachable = false;

    const entries = await sitemap();

    expect(entries).toHaveLength(STATIC_PATHS.length + blogPosts.length);
    expect(entries.map((entry) => entry.url)).toContain("https://dieselparts.uz/products");
  });

  /*
   * The locale left the URL, so a page has one address rather than three. This
   * pins that: a stray `/uz` prefix creeping back in would mean the sitemap and
   * the router disagree about where a page lives.
   */
  it("emits no locale-prefixed URLs", async () => {
    const entries = await sitemap();
    for (const entry of entries) {
      expect(entry.url).not.toMatch(/dieselparts\.uz\/(uz|ru|en)(\/|$)/);
    }
  });
});
