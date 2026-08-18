"use client";

import { useQuery } from "@tanstack/react-query";
import type { Locale } from "@/lib/i18n/locales";
import type { ResolvedProduct } from "@/lib/product-lookup";

/** Stable reference, so a caller's `useMemo` on `items` does not rerun. */
const EMPTY: ResolvedProduct[] = [];

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
): { items: ResolvedProduct[]; isLoading: boolean } {
  // Sorted, so reordering the cart does not refetch what is already cached.
  const key = [...ids].sort().join(",");

  const { data, isLoading } = useQuery({
    queryKey: ["products-by-ids", key, lang],
    enabled: ids.length > 0,
    queryFn: async (): Promise<ResolvedProduct[]> => {
      const params = new URLSearchParams({ ids: ids.join(","), lang });
      const response = await fetch(`/api/products/by-ids?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Failed to resolve products: ${response.status}`);
      }

      const body: { items: ResolvedProduct[] } = await response.json();
      return body.items;
    },
  });

  return {
    // `isLoading` is true for a disabled query too, so an empty list would
    // otherwise leave the screen in a permanent skeleton.
    items: data ?? EMPTY,
    isLoading: ids.length > 0 && isLoading,
  };
}
