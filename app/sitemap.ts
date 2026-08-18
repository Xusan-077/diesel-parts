import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-config";
import { SUPPORTED_LOCALES } from "@/lib/i18n/locales";
import {
  listBrands,
  listCategories,
  listProductSlugs,
} from "@/lib/api/product-repository";
import { blogPosts } from "@/lib/data/blog";


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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [productSlugs, categories, brands] = await Promise.all([
    listProductSlugs(),
    listCategories(),
    listBrands(),
  ]);

  const entries: MetadataRoute.Sitemap = [];

  for (const lang of SUPPORTED_LOCALES) {
    for (const path of STATIC_PATHS) {
      entries.push({ url: `${SITE_URL}/${lang}${path}`, lastModified: new Date() });
    }
    for (const slug of productSlugs) {
      entries.push({ url: `${SITE_URL}/${lang}/products/${slug}`, lastModified: new Date() });
    }
    for (const category of categories) {
      entries.push({ url: `${SITE_URL}/${lang}/categories/${category.slug}`, lastModified: new Date() });
    }
    for (const brand of brands) {
      entries.push({ url: `${SITE_URL}/${lang}/brands/${brand.slug}`, lastModified: new Date() });
    }
    for (const post of blogPosts) {
      entries.push({
        url: `${SITE_URL}/${lang}/blog/${post.slug}`,
        lastModified: new Date(post.publishedAt),
      });
    }
  }

  return entries;
}
