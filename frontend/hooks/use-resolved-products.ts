"use client";

import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import type { Locale } from "@/lib/i18n/locales";
import type { ResolvedProduct } from "@/lib/product-lookup";
import { readSnapshots } from "@/lib/store/snapshot";
import { useSnapshotStore } from "@/lib/store/stores";

/** Stable reference, so a caller's `useMemo` on `items` does not rerun. */
const EMPTY: ResolvedProduct[] = [];

export interface ResolvedProductsResult {
  items: ResolvedProduct[];
  isLoading: boolean;
  /**
   * The catalog actually answered. Callers use this before treating a missing
   * id as a deleted product rather than as an outage — a snapshot is never
   * evidence that a product still exists.
   */
  isSuccess: boolean;
}

/**
 * Resolves cart/wishlist/compare ids against the catalog.
 *
 * The lists are localStorage, and so is everything needed to draw them: the
 * rows from the last successful resolve are kept as snapshots, so the page
 * paints from the browser's own copy on the first frame instead of waiting on
 * `/api/products/by-ids`. The request still runs — a stale price on a parts
 * quote is worse than a skeleton — and its answer replaces the snapshot and
 * refreshes it for next time. An empty id list resolves without a request.
 */
export function useResolvedProducts(
  ids: readonly string[],
  lang: Locale,
): ResolvedProductsResult {
  // Sorted, so reordering the cart does not refetch what is already cached.
  const key = [...ids].sort().join(",");
  const order = ids.join(",");

  const byId = useSnapshotStore((state) => state.byId);
  const { record } = useSnapshotStore.getState();

  // Derived through a memo rather than inside the selector: a selector that
  // built a fresh array on every call would never compare equal and would
  // re-render this component forever.
  const cached = useMemo(
    () => readSnapshots(byId, order === "" ? [] : order.split(","), lang),
    [byId, order, lang],
  );

  const { data, isLoading, isSuccess } = useQuery({
    queryKey: ["products-by-ids", key, lang],
    enabled: ids.length > 0,
    queryFn: async (): Promise<ResolvedProduct[]> => {
      const { data } = await axios.get<{ items: ResolvedProduct[] }>(
        "/api/products/by-ids",
        { params: { ids: ids.join(","), lang } },
      );
      return data.items;
    },
  });

  useEffect(() => {
    if (data !== undefined) {
      record(data, lang);
    }
  }, [data, lang, record]);

  return {
    items: data ?? cached ?? EMPTY,
    // `isLoading` is true for a disabled query too, so an empty list would
    // otherwise leave the screen in a permanent skeleton. A complete set of
    // snapshots means there is nothing to wait for on screen.
    isLoading: ids.length > 0 && isLoading && cached === null,
    isSuccess,
  };
}
