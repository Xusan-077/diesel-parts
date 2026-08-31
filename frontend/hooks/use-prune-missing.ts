"use client";

import { useEffect } from "react";
import { MAX_PAGE_SIZE } from "@/lib/api/product-query";
import type { ResolvedProduct } from "@/lib/product-lookup";
import { canPrune, missingIds } from "@/lib/store/prune";
import { useSnapshotStore } from "@/lib/store/stores";

/**
 * Drops stored ids the catalog no longer knows about.
 *
 * Without this the header badge counts a retired part the cart page cannot
 * show, and the visitor has no line to click "remove" on. `canPrune` is what
 * keeps it from being destructive: an id is only deleted once a successful
 * read has positively failed to return it.
 *
 * The effect runs on the id list rather than the array identity, so a
 * re-render with the same ids does not re-enter it.
 */
export function usePruneMissing(
  ids: readonly string[],
  resolved: readonly ResolvedProduct[],
  isSuccess: boolean,
  remove: (id: string) => void,
): void {
  const requested = ids.join(",");
  const found = resolved.map((entry) => entry.product.id).join(",");

  useEffect(() => {
    const requestedIds = requested === "" ? [] : requested.split(",");
    if (!canPrune(requestedIds.length, MAX_PAGE_SIZE, isSuccess)) {
      return;
    }
    const { forget } = useSnapshotStore.getState();
    for (const id of missingIds(requestedIds, found === "" ? [] : found.split(","))) {
      remove(id);
      // The row is gone from the catalog, so its snapshot is not a cache of
      // anything any more.
      forget(id);
    }
  }, [requested, found, isSuccess, remove]);
}
