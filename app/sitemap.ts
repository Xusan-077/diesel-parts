import type { MetadataRoute } from "next";
import { SUPPORTED_LOCALES } from "@/lib/i18n/locales";
import { products } from "@/lib/data/products";
import { categories } from "@/lib/data/categories";
import { brands } from "@/lib/data/brands";
import { blogPosts } from "@/lib/data/blog";

const BASE_URL = "https://dieselparts.uz";

const STATIC_PATHS = ["", "/products", "/about", "/blog", "/contact", "/request-quote"];

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  for (const lang of SUPPORTED_LOCALES) {
    for (const path of STATIC_PATHS) {
      entries.push({ url: `${BASE_URL}/${lang}${path}`, lastModified: new Date() });
    }
    for (const product of products) {
      entries.push({ url: `${BASE_URL}/${lang}/products/${product.slug}`, lastModified: new Date() });
    }
    for (const category of categories) {
      entries.push({ url: `${BASE_URL}/${lang}/categories/${category.slug}`, lastModified: new Date() });
    }
    for (const brand of brands) {
      entries.push({ url: `${BASE_URL}/${lang}/brands/${brand.slug}`, lastModified: new Date() });
    }
    for (const post of blogPosts) {
      entries.push({
        url: `${BASE_URL}/${lang}/blog/${post.slug}`,
        lastModified: new Date(post.publishedAt),
      });
    }
  }

  return entries;
}
