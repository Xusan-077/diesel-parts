import type { AvailabilityFilter, SortKey } from "@/lib/filters";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/locales";

export const DEFAULT_PAGE_SIZE = 9;
export const MAX_PAGE_SIZE = 60;

const SORT_KEYS: SortKey[] = ["newest", "name-asc", "name-desc"];
const AVAILABILITY: AvailabilityFilter[] = ["all", "available", "limited", "out_of_stock"];

export interface ProductQuery {
  q: string;
  brandId: string;
  categoryId: string;
  /** Extra scope from the catalog menu; `undefined` means "no scope". */
  categoryIds?: string[];
  availability: AvailabilityFilter;
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

  return {
    q: (params.get("q") ?? "").trim(),
    brandId: params.get("brand") || "all",
    categoryId: params.get("category") || "all",
    categoryIds: params.has("categoryIds") ? categoryIds : undefined,
    availability: oneOf(params.get("availability"), AVAILABILITY, "all"),
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
