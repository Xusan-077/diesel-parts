"use client";

import {
  cartLineCount,
  cartUnitCount,
  findCartItem,
  type CartItem,
} from "@/lib/store/cart";
import { hasId } from "@/lib/store/collection";
import {
  MAX_COMPARE_ITEMS,
  useCartStore,
  useCompareStore,
  useWishlistStore,
} from "@/lib/store/stores";

export function useWishlist() {
  const ids = useWishlistStore((state) => state.ids);
  // Zustand actions keep a stable identity, so reading them off the store
  // avoids subscribing to them.
  const { toggle, remove, clear } = useWishlistStore.getState();

  return {
    ids,
    count: ids.length,
    has: (id: string) => hasId(ids, id),
    toggle,
    remove,
    clear,
  };
}

export function useCompare() {
  const ids = useCompareStore((state) => state.ids);
  const { toggle, remove, clear } = useCompareStore.getState();

  return {
    ids,
    count: ids.length,
    max: MAX_COMPARE_ITEMS,
    isFull: ids.length >= MAX_COMPARE_ITEMS,
    has: (id: string) => hasId(ids, id),
    toggle,
    remove,
    clear,
  };
}

export function useCart() {
  const items = useCartStore((state) => state.items);
  const { add, setQuantity, remove, clear } = useCartStore.getState();

  return {
    items,
    unitCount: cartUnitCount(items),
    lineCount: cartLineCount(items),
    has: (id: string) => findCartItem(items, id) !== undefined,
    quantityOf: (id: string) => findCartItem(items, id)?.quantity ?? 0,
    add,
    setQuantity,
    remove,
    clear,
  };
}

export type { CartItem };
