import "server-only";
import { BackendApiError, backendRequest } from "./backend-client";
import type { Locale } from "@/lib/i18n/locales";
import type { ResolvedProduct } from "@/lib/product-lookup";
import type { Brand, Category, Product } from "@/lib/types";
import { toBrand, toCategory, toProduct, type BrandRow, type CategoryRow, type ProductRow } from "./product-mapper";
import { buildPage, type ProductPage, type ProductQuery } from "./product-query";
import { getProductStats } from "./product-stats-repository";

interface BackendPage<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

/** A backend/ category tree node — `findTree`'s nested shape, one root per array entry. */
interface CategoryTreeNode extends CategoryRow {
  children: CategoryTreeNode[];
}

/**
 * The single place catalog data is read from.
 *
 * Server components and route handlers both call this directly — the server
 * never issues an HTTP request to its own API. The browser reaches the same
 * data through `/api/products` and `/api/products/by-ids`.
 */
export async function queryProducts(query: ProductQuery): Promise<ProductPage<Product>> {
  // A deliberate empty scope from the catalog menu (every box in that branch
  // unticked) can never match anything — answering locally skips a round trip
  // to a backend/ query that is guaranteed to come back empty.
  if (query.categoryIds !== undefined && query.categoryIds.length === 0) {
    return { ...buildPage<Product>([], 0, query.page, query.pageSize), stats: {} };
  }

  const result = await backendRequest<BackendPage<ProductRow>>("/catalog/products", {
    query: {
      search: query.q || undefined,
      lang: query.lang,
      brandIds: query.brandIds.join(","),
      categoryIds: query.categoryIds?.join(","),
      categoryId: query.categoryIds === undefined && query.categoryId !== "all" ? query.categoryId : undefined,
      stockStatus: query.availability !== "all" ? query.availability : undefined,
      priceMin: query.priceMin ?? undefined,
      priceMax: query.priceMax ?? undefined,
      sort: query.sort,
      page: query.page,
      limit: query.pageSize,
    },
  });

  const page = buildPage(result.data.map(toProduct), result.meta.total, result.meta.page, result.meta.limit);
  const stats = await getProductStats(page.items.map((product) => product.id));

  return { ...page, stats: Object.fromEntries(stats) };
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  try {
    return toProduct(await backendRequest<ProductRow>(`/catalog/products/${encodeURIComponent(slug)}`));
  } catch (error) {
    // Only a genuine 404 (missing or retired slug) means "no product" — any
    // other failure (backend/ unreachable, a 5xx) must still surface as an
    // error rather than render as a wrong "not found" page.
    if (error instanceof BackendApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
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

  const result = await backendRequest<BackendPage<ProductRow & { category: CategoryRow; brand: { name: string } }>>(
    "/catalog/products",
    // Capped at backend/'s own page-size limit — a cart, wishlist or compare
    // list this long is not a realistic case this app's UI produces today.
    { query: { ids: ids.join(","), limit: Math.min(ids.length, 100) } },
  );

  const byId = new Map(
    result.data.map((row) => [
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
  const rows = await backendRequest<BrandRow[]>("/catalog/brands");
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
 * them. `null` means there is nothing priced to slide over at all. Computed
 * from one full-catalog read rather than a dedicated backend/ aggregate — the
 * catalog is small enough (under the 100-row page cap) that this costs one
 * extra request, not a second query engine.
 */
export async function getPriceBounds(): Promise<{ min: number; max: number } | null> {
  const result = await backendRequest<BackendPage<Pick<ProductRow, "price">>>("/catalog/products", {
    query: { limit: 100 },
  });

  const prices = result.data.map((row) => row.price).filter((price): price is string => price !== null).map(Number);

  if (prices.length === 0) {
    return null;
  }

  const step = 10_000;
  const low = Math.floor(Math.min(...prices) / step) * step;
  const high = Math.ceil(Math.max(...prices) / step) * step;

  // A catalog where everything costs the same would collapse the track to a
  // point; widening by one step keeps the control operable.
  return { min: low, max: high > low ? high : low + step };
}

/** Flattens backend/'s nested category tree back to the flat list this app's other readers expect. */
function flattenCategoryTree(nodes: readonly CategoryTreeNode[]): CategoryRow[] {
  const flat: CategoryRow[] = [];
  for (const node of nodes) {
    const { children, ...row } = node;
    flat.push(row);
    flat.push(...flattenCategoryTree(children));
  }
  return flat;
}

/**
 * Every category, in menu order.
 *
 * backend/'s only public endpoint returns a pre-nested tree (it owns the
 * ordering rule this once read `order`/`nameUz` for); flattened here since
 * every current caller of this function wants a flat list to nest itself, not
 * this shape.
 */
export async function listCategories(): Promise<Category[]> {
  const tree = await backendRequest<CategoryTreeNode[]>("/catalog/categories");
  return flattenCategoryTree(tree).map(toCategory);
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
  const [popular, newest, bestSellers] = await Promise.all([
    backendRequest<BackendPage<ProductRow>>("/catalog/products", { query: { sort: "id", limit: count } }),
    backendRequest<BackendPage<ProductRow>>("/catalog/products", { query: { limit: count } }),
    backendRequest<BackendPage<ProductRow>>("/catalog/products", {
      query: { sort: "id", stockStatus: "available", limit: count },
    }),
  ]);

  return {
    popular: popular.data.map(toProduct),
    newest: newest.data.map(toProduct),
    bestSellers: bestSellers.data.map(toProduct),
  };
}

/** Every active product slug, for the sitemap. Slugs only — no row mapping. */
export async function listProductSlugs(): Promise<string[]> {
  return backendRequest<string[]>("/catalog/products/slugs");
}
