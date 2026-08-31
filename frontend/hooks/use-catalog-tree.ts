"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import type { CatalogNode, CatalogTreeResponse } from "@/lib/catalog-tree";

/** Stable reference, so a caller mapping over `items` does not rerun on every render. */
const EMPTY: CatalogNode[] = [];

export interface CatalogTreeResult {
  items: CatalogNode[];
  isLoading: boolean;
  isError: boolean;
  retry: () => void;
}

/**
 * The catalog menu, fetched once per browser session.
 *
 * `enabled` is what keeps this off the critical path: the menu lives in the
 * header of every page but is opened on a minority of visits, so the request
 * only goes out when someone actually opens it. React Query then holds the
 * answer for the rest of the session — the header and the mobile drawer share
 * one cache key, so opening one after the other costs nothing.
 *
 * The tree carries all three locales, which is why the key has no language in
 * it: switching language re-reads the same cached rows.
 */
export function useCatalogTree(enabled: boolean): CatalogTreeResult {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["catalog-tree"],
    enabled,
    // The menu changes when a director edits it, which is rare; a visitor who
    // opens it twice in a session should not pay for a second request.
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<CatalogNode[]> => {
      const { data } = await axios.get<CatalogTreeResponse>("/api/catalog");
      return data.items;
    },
  });

  return {
    items: data ?? EMPTY,
    // `isLoading` stays true while the query is disabled, which would otherwise
    // leave a closed menu reporting itself as loading forever.
    isLoading: enabled && isLoading,
    isError,
    retry: () => void refetch(),
  };
}
