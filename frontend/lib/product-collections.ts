import type { ProductStats } from "./product-stats";
import type { Product } from "./types";

/**
 * How many parts each home page collection holds.
 *
 * Set by the desktop layout, which is a four-column grid: eight is two full
 * rows, and two rows is the most a home page can spend on one collection when
 * there are three of them stacked down it. Twelve — the count from when every
 * row was a carousel at every width — made three rows, and three collections
 * of three rows is nine screens of cards before the page says anything else.
 *
 * On a phone the same eight ride a carousel, so the number is what the row
 * scrolls through rather than what it stacks. The rest of the collection is
 * one press away behind "see all", which is what that link is for.
 */
export const HOME_ROW_SIZE = 8;

/**
 * The ceiling `/api/products/home` will honour for `?limit=`.
 *
 * Three collections come back in one response, so a limit of n costs up to 3n
 * rows plus their stats. Twenty-four is three full desktop grids per row, well
 * past anything the page asks for, and it stops a hand-edited URL turning the
 * home feed into a full table scan.
 */
export const MAX_HOME_ROW_SIZE = 24;

/** The three collections the home page stacks, in the order it stacks them. */
export const HOME_COLLECTIONS = ["popular", "newest", "bestSellers"] as const;

export type HomeCollection = (typeof HOME_COLLECTIONS)[number];

/**
 * The names a card shows under its title, resolved from the brand and category
 * tables. Kept beside the products rather than on them because `Product` is the
 * catalog row — the cart snapshots it into localStorage, and a display name
 * looked up at read time has no business being frozen there.
 */
export interface ProductCardMeta {
  categoryName: string;
  brandName: string;
}

/**
 * Everything the three home rows need, in one response.
 *
 * One request rather than three: the collections overlap (a new part is often
 * also in stock), and shared `meta` and `stats` maps keyed by product id mean a
 * part that appears twice is described once. The maps cover every id in `rows`;
 * an id missing from either is a reference read that degraded, which the card
 * renders as a blank caption rather than as no card.
 */
export interface HomeProductsResponse {
  rows: Record<HomeCollection, Product[]>;
  meta: Record<string, ProductCardMeta>;
  stats: Record<string, ProductStats>;
}
