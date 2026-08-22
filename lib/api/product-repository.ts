import { prisma } from "@/lib/db";
import type { Locale } from "@/lib/i18n/locales";
import type { ResolvedProduct } from "@/lib/product-lookup";
import type { Brand, Category, Product } from "@/lib/types";
import { toBrand, toCategory, toProduct } from "./product-mapper";
import {
  buildPage,
  pageSkip,
  type ProductPage,
  type ProductQuery,
} from "./product-query";
import { getProductStats } from "./product-stats-repository";
import { buildProductWhere } from "./product-where";

/**
 * The single place catalog data is read from.
 *
 * Server components and route handlers both call this directly — the server
 * never issues an HTTP request to its own API. The browser reaches the same
 * data through `/api/products` and `/api/products/by-ids`.
 */
export async function queryProducts(query: ProductQuery): Promise<ProductPage<Product>> {
  const { where, orderBy } = buildProductWhere(query);

  /*
   * The count runs first, and the page number is clamped against it before the
   * rows are fetched. Issuing both in parallel would be one round trip faster,
   * but `?page=99` would then skip past the end and render an empty catalog that
   * claims to be "page 2 of 2" — the in-memory `paginate` this replaces
   * deliberately clamped first, and that behaviour is preserved here.
   */
  const total = await prisma.product.count({ where });
  const clampedPage = buildPage([], total, query.page, query.pageSize).page;

  const rows = await prisma.product.findMany({
    where,
    orderBy,
    skip: pageSkip(clampedPage, query.pageSize),
    take: query.pageSize,
  });

  const page = buildPage(rows.map(toProduct), total, clampedPage, query.pageSize);
  const stats = await getProductStats(page.items.map((product) => product.id));

  return { ...page, stats: Object.fromEntries(stats) };
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const row = await prisma.product.findFirst({ where: { slug, isActive: true } });
  return row === null ? null : toProduct(row);
}

/**
 * Resolves stored ids to products, dropping any that no longer exist — the
 * wishlist, cart and compare list live in localStorage and can outlive a
 * catalog change.
 */
export async function getProductsByIds(
  ids: readonly string[],
  lang: Locale,
): Promise<ResolvedProduct[]> {
  if (ids.length === 0) {
    return [];
  }

  const rows = await prisma.product.findMany({
    where: { id: { in: [...ids] }, isActive: true },
    include: { brand: true, category: true },
  });

  const byId = new Map(
    rows.map((row) => [
      row.id,
      {
        product: toProduct(row),
        brandName: row.brand.name,
        categoryName: toCategory(row.category).name[lang],
      },
    ]),
  );

  // Preserve the caller's order: the cart shows items in the order added.
  return ids
    .map((id) => byId.get(id))
    .filter((entry): entry is ResolvedProduct => entry !== undefined);
}

export async function listBrands(): Promise<Brand[]> {
  const rows = await prisma.brand.findMany({ orderBy: { name: "asc" } });
  return rows.map(toBrand);
}

/**
 * The cheapest and dearest priced product in the catalog.
 *
 * The slider needs real ends, and guessing them is worse than not shipping
 * one: a track that runs to 100 000 000 when nothing costs over 4 000 000
 * leaves every useful position inside the first few pixels. Rounded outwards to
 * a round figure so the thumbs land on numbers a reader would type themselves.
 *
 * Products with no price are ignored here, exactly as the price filter ignores
 * them. `null` means there is nothing priced to slide over at all.
 */
export async function getPriceBounds(): Promise<{ min: number; max: number } | null> {
  const result = await prisma.product.aggregate({
    where: { isActive: true, price: { not: null } },
    _min: { price: true },
    _max: { price: true },
  });

  const min = result._min.price;
  const max = result._max.price;

  if (min === null || max === null) {
    return null;
  }

  const step = 10_000;
  const low = Math.floor(min.toNumber() / step) * step;
  const high = Math.ceil(max.toNumber() / step) * step;

  // A catalog where everything costs the same would collapse the track to a
  // point; widening by one step keeps the control operable.
  return { min: low, max: high > low ? high : low + step };
}

/**
 * Every category, in menu order.
 *
 * Ordered here rather than in the filter sidebar: the sidebar nests these rows
 * into a tree and a stable input order is what lets it do that without a second
 * sort key. Ties break on the Uzbek name for the same reason the menu does it —
 * the tree's shape should not change when the reader changes language.
 */
export async function listCategories(): Promise<Category[]> {
  const rows = await prisma.category.findMany({ orderBy: [{ order: "asc" }, { nameUz: "asc" }] });
  return rows.map(toCategory);
}

/**
 * The three home rows. One bounded query per row rather than one unbounded
 * query sliced in memory — the point of moving this work into SQL was to stop
 * loading the whole table.
 */
export async function getProductsForHomeRows(count: number): Promise<{
  popular: Product[];
  newest: Product[];
  bestSellers: Product[];
}> {
  const active = { isActive: true } as const;

  const [popular, newest, bestSellers] = await Promise.all([
    prisma.product.findMany({ where: active, orderBy: { id: "asc" }, take: count }),
    prisma.product.findMany({ where: active, orderBy: { createdAt: "desc" }, take: count }),
    prisma.product.findMany({
      where: { ...active, stockStatus: "available" },
      orderBy: { id: "asc" },
      take: count,
    }),
  ]);

  return {
    popular: popular.map(toProduct),
    newest: newest.map(toProduct),
    bestSellers: bestSellers.map(toProduct),
  };
}

/** Every active product slug, for the sitemap. Slugs only — no row mapping. */
export async function listProductSlugs(): Promise<string[]> {
  const rows = await prisma.product.findMany({
    where: { isActive: true },
    select: { slug: true },
    orderBy: { id: "asc" },
  });
  return rows.map((row) => row.slug);
}
