"use client";

import { create } from "zustand";
import { persist, type PersistStorage } from "zustand/middleware";
import {
  addToCart,
  parseCart,
  removeFromCart,
  setCartQuantity,
  type CartItem,
} from "./cart";
import { parseIdList, removeId, toggleId } from "./collection";
import { normalizePersistedValue } from "./persist-storage";
import {
  forgetSnapshot,
  parseSnapshots,
  recordSnapshots,
  type SnapshotMap,
} from "./snapshot";
import type { Locale } from "@/lib/i18n/locales";
import type { ResolvedProduct } from "@/lib/product-lookup";

export const MAX_COMPARE_ITEMS = 4;

/**
 * localStorage adapter that also understands the bare-array format this app
 * wrote before zustand, so an existing cart is not silently dropped.
 */
function createStorage<T>(sliceKey: string): PersistStorage<T> {
  return {
    getItem: (name) =>
      normalizePersistedValue(localStorage.getItem(name), sliceKey) as
        | { state: T }
        | null,
    setItem: (name, value) => localStorage.setItem(name, JSON.stringify(value)),
    removeItem: (name) => localStorage.removeItem(name),
  };
}

/**
 * `skipHydration` keeps the first client render identical to the server HTML
 * (empty collections). `StoreHydration` rehydrates in an effect right after
 * mount, so there is never a hydration mismatch.
 */
const SKIP_HYDRATION = { skipHydration: true } as const;

interface IdListState {
  ids: string[];
  toggle: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
}

type IdListSlice = Pick<IdListState, "ids">;

function idListPersistOptions(name: string) {
  return {
    ...SKIP_HYDRATION,
    name,
    storage: createStorage<IdListSlice>("ids"),
    partialize: (state: IdListState): IdListSlice => ({ ids: state.ids }),
    merge: (persisted: unknown, current: IdListState): IdListState => ({
      ...current,
      ids: parseIdList((persisted as IdListSlice | undefined)?.ids),
    }),
  };
}

export const useWishlistStore = create<IdListState>()(
  persist(
    (set) => ({
      ids: [],
      toggle: (id) => set((state) => ({ ids: toggleId(state.ids, id) })),
      remove: (id) => set((state) => ({ ids: removeId(state.ids, id) })),
      clear: () => set({ ids: [] }),
    }),
    idListPersistOptions("diesel-parts:wishlist")
  )
);

export const useCompareStore = create<IdListState>()(
  persist(
    (set) => ({
      ids: [],
      toggle: (id) => set((state) => ({ ids: toggleId(state.ids, id, MAX_COMPARE_ITEMS) })),
      remove: (id) => set((state) => ({ ids: removeId(state.ids, id) })),
      clear: () => set({ ids: [] }),
    }),
    idListPersistOptions("diesel-parts:compare")
  )
);

interface CartState {
  items: CartItem[];
  add: (productId: string, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
}

type CartSlice = Pick<CartState, "items">;

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      add: (productId, quantity = 1) =>
        set((state) => ({ items: addToCart(state.items, productId, quantity) })),
      setQuantity: (productId, quantity) =>
        set((state) => ({ items: setCartQuantity(state.items, productId, quantity) })),
      remove: (productId) => set((state) => ({ items: removeFromCart(state.items, productId) })),
      clear: () => set({ items: [] }),
    }),
    {
      ...SKIP_HYDRATION,
      name: "diesel-parts:cart",
      storage: createStorage<CartSlice>("items"),
      partialize: (state): CartSlice => ({ items: state.items }),
      merge: (persisted, current): CartState => ({
        ...current,
        items: parseCart((persisted as CartSlice | undefined)?.items),
      }),
    }
  )
);

interface SnapshotState {
  byId: SnapshotMap;
  record: (entries: readonly ResolvedProduct[], lang: Locale) => void;
  forget: (productId: string) => void;
}

type SnapshotSlice = Pick<SnapshotState, "byId">;

/**
 * The catalog rows behind the id lists, so the cart, wishlist and compare
 * pages have something to draw before — or without — a network answer.
 * See lib/store/snapshot.ts for why this is separate from the lists.
 */
export const useSnapshotStore = create<SnapshotState>()(
  persist(
    (set) => ({
      byId: {},
      record: (entries, lang) =>
        set((state) => ({ byId: recordSnapshots(state.byId, entries, lang) })),
      forget: (productId) =>
        set((state) => ({ byId: forgetSnapshot(state.byId, productId) })),
    }),
    {
      ...SKIP_HYDRATION,
      name: "diesel-parts:snapshots",
      storage: createStorage<SnapshotSlice>("byId"),
      partialize: (state): SnapshotSlice => ({ byId: state.byId }),
      merge: (persisted, current): SnapshotState => ({
        ...current,
        byId: parseSnapshots((persisted as SnapshotSlice | undefined)?.byId),
      }),
    }
  )
);

/** Called once after mount to load persisted state without a render mismatch. */
export function rehydrateStores(): void {
  void useWishlistStore.persist.rehydrate();
  void useCompareStore.persist.rehydrate();
  void useCartStore.persist.rehydrate();
  void useSnapshotStore.persist.rehydrate();
}
