"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import type { Locale } from "@/lib/i18n/locales";
import type { ResolvedProduct } from "@/lib/product-lookup";

/** Stable reference, so a caller's `useMemo` on `items` does not rerun. */
const EMPTY: ResolvedProduct[] = [];

export interface ResolvedProductsResult {
  items: ResolvedProduct[];
  isLoading: boolean;
  /**
   * The catalog actually answered. Callers use this before treating a missing
   * id as a deleted product rather than as an outage.
   */
  isSuccess: boolean;
}

/**
 * Resolves cart/wishlist/compare ids against the catalog.
 *
 * These lists live in localStorage, so the ids arrive on the client and the
 * catalog is no longer in the bundle. An empty id list resolves without a
 * request.
 */
export function useResolvedProducts(
  ids: readonly string[],
  lang: Locale,
): ResolvedProductsResult {
  // Sorted, so reordering the cart does not refetch what is already cached.
  const key = [...ids].sort().join(",");

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

  return {
    // `isLoading` is true for a disabled query too, so an empty list would
    // otherwise leave the screen in a permanent skeleton.
    items: data ?? EMPTY,
    isLoading: ids.length > 0 && isLoading,
    isSuccess,
  };
}
