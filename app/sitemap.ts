import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-config";
import {
  listBrands,
  listCategories,
  listProductSlugs,
} from "@/lib/api/product-repository";
import { safeRead } from "@/lib/api/safe-read";
import type { Brand, Category } from "@/lib/types";
import { blogPosts } from "@/lib/data/blog";

/**
 * Built per request rather than baked into the deploy.
 *
 * Next prerenders `sitemap.ts` at build time by default, which has always meant
 * a product added after a deploy stayed out of the sitemap until the next one.
 * With the reads below now degrading instead of throwing, that default became
 * actively harmful: a build run while the database was unreachable would freeze
 * a catalog-less sitemap into the deploy and serve it happily for days. Built
 * per request, a short sitemap lasts exactly as long as the outage does.
 *
 * The cost is three queries on a file that only crawlers ask for.
 */
export const dynamic = "force-dynamic";

export const STATIC_PATHS = [
  "",
  "/products",
  "/brands",
  "/partnership",
  "/services",
  "/delivery",
  "/payment",
  "/about",
  "/blog",
  "/contact",
  "/request-quote",
];

/**
 * One entry per page, not one per page and locale: the locale is a cookie now,
 * so `/products` is the only address the Russian catalogue has.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  /*
   * A sitemap that 500s is worse than a short one: a crawler retries a 200 on
   * its own schedule, but an error teaches it the file is unreliable. The
   * static routes below need no database and are always emitted.
   */
  const [productSlugs, categories, brands] = await Promise.all([
    safeRead("sitemap product slugs", listProductSlugs, [] as string[]),
    safeRead("sitemap categories", listCategories, [] as Category[]),
    safeRead("sitemap brands", listBrands, [] as Brand[]),
  ]);

  const entries: MetadataRoute.Sitemap = [];

  for (const path of STATIC_PATHS) {
    entries.push({ url: `${SITE_URL}${path}`, lastModified: new Date() });
  }
  for (const slug of productSlugs.data) {
    entries.push({ url: `${SITE_URL}/products/${slug}`, lastModified: new Date() });
  }
  for (const category of categories.data) {
    entries.push({ url: `${SITE_URL}/categories/${category.slug}`, lastModified: new Date() });
  }
  for (const brand of brands.data) {
    entries.push({ url: `${SITE_URL}/brands/${brand.slug}`, lastModified: new Date() });
  }
  for (const post of blogPosts) {
    entries.push({
      url: `${SITE_URL}/blog/${post.slug}`,
      lastModified: new Date(post.publishedAt),
    });
  }

  return entries;
}
