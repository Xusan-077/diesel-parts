"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchHomeProducts, homeProductsQueryKey } from "@/lib/api/products";
import type { Locale } from "@/lib/i18n/locales";
import {
  HOME_ROW_SIZE,
  type HomeCollection,
  type HomeProductsResponse,
} from "@/lib/product-collections";
import type { ProductStats } from "@/lib/product-stats";
import type { Product } from "@/lib/types";

/** Stable reference, so a row whose collection is empty does not re-render. */
const EMPTY: Product[] = [];

export interface HomeProductsResult {
  products: Product[];
  meta: HomeProductsResponse["meta"];
  stats: Record<string, ProductStats>;
  isPending: boolean;
  isError: boolean;
  retry: () => void;
}

export interface HomeProductsOptions {
  limit?: number;
  /**
   * The same payload the API would return, read during the page's server
   * render. Seeding the cache with it is what keeps the cards in the HTML a
   * crawler is served — see `HomeProductRow`. `undefined` means the server read
   * failed or was skipped, and the row falls back to fetching.
   */
  initialData?: HomeProductsResponse;
}

/**
 * One collection of the home feed, from `/api/products/home`.
 *
 * The three rows on the page each call this with their own collection name and
 * all share one query key, so they are one cache entry and one request — the
 * rows are interleaved with other sections down the page and cannot be one
 * component, but they are one read. Whichever row renders first seeds that
 * entry from `initialData`; the other two then find it already filled, which is
 * why passing the same payload to all three is not three copies of the work.
 *
 * With a seed, the first visit issues no request at all: React Query treats
 * `initialData` as fresh, and `staleTime` holds it that way. The request goes
 * out when the seed goes stale, when the seed is missing because the server
 * read failed, or when a reader presses "try again" — which is the whole point
 * of routing the browser through the API rather than freezing the server's
 * answer into the page.
 *
 * `staleTime` is long because the catalog changes when a director edits it,
 * which is rare; a visitor who returns to the home page mid-session should not
 * pay for a second request.
 */
export function useHomeProducts(
  collection: HomeCollection,
  lang: Locale,
  { limit = HOME_ROW_SIZE, initialData }: HomeProductsOptions = {},
): HomeProductsResult {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: homeProductsQueryKey({ lang, limit }),
    queryFn: () => fetchHomeProducts({ lang, limit }),
    initialData,
    staleTime: 5 * 60_000,
  });

  return {
    products: data?.rows[collection] ?? EMPTY,
    meta: data?.meta ?? {},
    // A part with no row in `stats` reads as an unreviewed one, which is what
    // the card already renders for a stats read that degraded server-side.
    stats: data?.stats ?? {},
    isPending,
    isError,
    retry: () => void refetch(),
  };
}
