import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-config";
import { SUPPORTED_LOCALES } from "@/lib/i18n/locales";
import { products } from "@/prisma/seed-data/products";
import { categories } from "@/prisma/seed-data/categories";
import { brands } from "@/prisma/seed-data/brands";
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

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  for (const lang of SUPPORTED_LOCALES) {
    for (const path of STATIC_PATHS) {
      entries.push({ url: `${SITE_URL}/${lang}${path}`, lastModified: new Date() });
    }
    for (const product of products) {
      entries.push({ url: `${SITE_URL}/${lang}/products/${product.slug}`, lastModified: new Date() });
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
