import { prisma } from "@/lib/db";
import type { Locale } from "@/lib/i18n/locales";
import type { ResolvedProduct } from "@/lib/product-lookup";
import type { Brand, Category, Product } from "@/lib/types";
import { toBrand, toCategory, toProduct } from "./product-mapper";
import { buildPage, pageSkip, type Page, type ProductQuery } from "./product-query";
import { buildProductWhere } from "./product-where";

/**
 * The single place catalog data is read from.
 *
 * Server components and route handlers both call this directly — the server
 * never issues an HTTP request to its own API. The browser reaches the same
 * data through `/api/products` and `/api/products/by-ids`.
 */
export async function queryProducts(query: ProductQuery): Promise<Page<Product>> {
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

  return buildPage(rows.map(toProduct), total, clampedPage, query.pageSize);
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

export async function listCategories(): Promise<Category[]> {
  const rows = await prisma.category.findMany({ orderBy: { id: "asc" } });
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
