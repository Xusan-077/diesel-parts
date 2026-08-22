import { getProductStats } from "./product-stats-repository";
import {
  getProductsForHomeRows,
  listBrands,
  listCategories,
} from "./product-repository";
import { safeRead } from "./safe-read";
import type { Locale } from "@/lib/i18n/locales";
import {
  HOME_ROW_SIZE,
  MAX_HOME_ROW_SIZE,
  type HomeProductsResponse,
  type ProductCardMeta,
} from "@/lib/product-collections";
import type { ProductStats } from "@/lib/product-stats";
import type { Brand, Category } from "@/lib/types";

/**
 * The number of parts per row, from a `?limit=` value.
 *
 * Anything unparseable falls back rather than erroring, the same way
 * `parseProductQuery` treats a hand-edited catalog URL — a bad query string
 * should still return the page's usual answer, not a 400.
 */
export function homeRowSize(raw: string | null): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed)) {
    return HOME_ROW_SIZE;
  }
  return Math.min(MAX_HOME_ROW_SIZE, Math.max(1, parsed));
}

/**
 * The three home page collections, with the names and figures their cards need.
 *
 * Read twice per visit and assembled once here: the home page calls it during
 * its server render to seed React Query, and `/api/products/home` calls it for
 * every read after that. The server never fetches its own API to get this — it
 * calls the repository directly, exactly like every other server-side read.
 *
 * The degradation policy is part of the shape. The products are what the rows
 * *are*, so a failed catalog read is left to throw: the page turns that into a
 * row with a retry button, the route into a 503. Brands, categories and review
 * counts are captions on those cards — losing them costs a line under each
 * card, not the row, so they degrade to blanks and the read still succeeds.
 */
export async function readHomeProducts(
  count: number,
  lang: Locale,
): Promise<HomeProductsResponse> {
  const rows = await getProductsForHomeRows(count);

  // Deduplicated: the collections overlap, and a part in two of them should be
  // looked up once.
  const ids = [...new Set(Object.values(rows).flat().map((product) => product.id))];

  const [brands, categories, stats] = await Promise.all([
    safeRead("home rows brands", listBrands, [] as Brand[]),
    safeRead("home rows categories", listCategories, [] as Category[]),
    safeRead("home rows stats", () => getProductStats(ids), new Map<string, ProductStats>()),
  ]);

  const brandName = new Map(brands.data.map((brand) => [brand.id, brand.name]));
  const categoryName = new Map(
    categories.data.map((category) => [category.id, category.name[lang]]),
  );

  const meta: Record<string, ProductCardMeta> = {};
  for (const product of Object.values(rows).flat()) {
    meta[product.id] = {
      brandName: brandName.get(product.brandId) ?? "",
      categoryName: categoryName.get(product.categoryId) ?? "",
    };
  }

  return { rows, meta, stats: Object.fromEntries(stats.data) };
}
