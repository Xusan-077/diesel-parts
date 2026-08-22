import type { AvailabilityFilter, SortKey } from "@/lib/filters";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/locales";
import type { ProductStats } from "@/lib/product-stats";

export const DEFAULT_PAGE_SIZE = 9;
export const MAX_PAGE_SIZE = 60;

const SORT_KEYS: SortKey[] = ["newest", "name-asc", "name-desc"];
const AVAILABILITY: AvailabilityFilter[] = ["all", "available", "limited", "out_of_stock"];

export interface ProductQuery {
  q: string;
  /**
   * Brands the reader ticked. Empty means "every brand" — a list filter has no
   * "all" option to select, so absence is the only honest way to say it.
   */
  brandIds: string[];
  categoryId: string;
  /** Extra scope from the catalog menu; `undefined` means "no scope". */
  categoryIds?: string[];
  availability: AvailabilityFilter;
  /** Inclusive price bounds in UZS. `null` on either end means unbounded. */
  priceMin: number | null;
  priceMax: number | null;
  sort: SortKey;
  page: number;
  pageSize: number;
  lang: Locale;
}

function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

/**
 * A price bound, or `null` when there isn't one.
 *
 * Negative and non-numeric values are dropped rather than clamped to zero: a
 * bound nobody could have meant should widen the results back out, not silently
 * narrow them.
 */
function priceBound(raw: string | null): number | null {
  if (raw === null || raw.trim() === "") {
    return null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function oneOf<T extends string>(raw: string | null, allowed: T[], fallback: T): T {
  return allowed.includes(raw as T) ? (raw as T) : fallback;
}

/**
 * Turns raw search params into a fully defaulted query. Unknown or malformed
 * values fall back rather than erroring, so a hand-edited URL still returns
 * results instead of a 400.
 */
export function parseProductQuery(params: URLSearchParams): ProductQuery {
  const rawLang = params.get("lang");
  const categoryIds = params.getAll("categoryIds").filter((id) => id.length > 0);
  // `brand` repeats, one per ticked box. The legacy single-value form and the
  // "all" sentinel the selects used to send both still parse to "no filter".
  const brandIds = params.getAll("brand").filter((id) => id.length > 0 && id !== "all");

  const priceMin = priceBound(params.get("priceMin"));
  const priceMax = priceBound(params.get("priceMax"));

  return {
    q: (params.get("q") ?? "").trim(),
    brandIds,
    categoryId: params.get("category") || "all",
    categoryIds: params.has("categoryIds") ? categoryIds : undefined,
    availability: oneOf(params.get("availability"), AVAILABILITY, "all"),
    // A reversed range is read the way it was meant rather than refused; the
    // slider cannot produce one, but a hand-edited URL can.
    priceMin: priceMin !== null && priceMax !== null ? Math.min(priceMin, priceMax) : priceMin,
    priceMax: priceMin !== null && priceMax !== null ? Math.max(priceMin, priceMax) : priceMax,
    sort: oneOf(params.get("sort"), SORT_KEYS, "newest"),
    page: clampInt(params.get("page"), 1, 1, Number.MAX_SAFE_INTEGER),
    pageSize: clampInt(params.get("pageSize"), DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE),
    lang: rawLang && isLocale(rawLang) ? rawLang : DEFAULT_LOCALE,
  };
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * A page of products plus the rating and sold counts for exactly those rows.
 *
 * A sidecar keyed by product id rather than a field on `Product`: `Product` is
 * the catalog row and is snapshotted into localStorage by the cart, and a
 * review count is a live figure that has no business being frozen there.
 */
export interface ProductPage<T> extends Page<T> {
  stats: Record<string, ProductStats>;
}

/**
 * Assembles a `Page` from a SQL result plus its `count()`, preserving the
 * page-clamping behaviour the in-memory slice it replaced used to provide.
 */
export function buildPage<T>(items: T[], total: number, page: number, pageSize: number): Page<T> {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    items,
    total,
    page: Math.min(Math.max(1, page), totalPages),
    pageSize,
    totalPages,
  };
}

/**
 * The `skip` for a page, clamped so a bad page number cannot go negative.
 *
 * Callers MUST pass the page number already clamped by `buildPage`, not the raw
 * request value. This function cannot clamp the upper bound itself — it never
 * sees `total` — so a raw out-of-range page skips past the end and returns no
 * rows while the response still claims to be a valid page.
 */
export function pageSkip(page: number, pageSize: number): number {
  return Math.max(0, (Math.max(1, page) - 1) * pageSize);
}
