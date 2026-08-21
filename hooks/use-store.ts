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
import { useLanguageStore } from "@/lib/store/language-store";
import { useThemeStore } from "@/lib/store/theme-store";
import { resolveTheme, type ResolvedTheme, type Theme } from "@/lib/store/theme";
import type { Locale } from "@/lib/i18n/locales";

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

/**
 * The replacement for `next-themes`' own `useTheme`. `theme` is the stored
 * preference, which can be `system`; `resolvedTheme` and `isDark` are what is
 * actually on screen. Deriving them here keeps the string literals in one
 * place instead of in every caller.
 */
export function useTheme() {
  const theme = useThemeStore((state) => state.theme);
  const systemDark = useThemeStore((state) => state.systemDark);
  const { setTheme, toggleTheme } = useThemeStore.getState();
  const resolvedTheme = resolveTheme(theme, systemDark);

  return {
    theme,
    resolvedTheme,
    isDark: resolvedTheme === "dark",
    setTheme,
    toggleTheme,
  };
}

/**
 * The language the visitor chose, and the setter that persists it.
 *
 * `serverLanguage` is what the page was rendered in — the cookie's value. It is
 * required rather than optional because it is the answer for the first client
 * render: the store is still on its default then (`skipHydration`), and
 * returning that default would flip the switcher to UZ for a beat on every
 * Russian page load. After `LanguageSync` has rehydrated, the store wins.
 *
 * `setLanguage` writes localStorage and the cookie; it does not re-render the
 * page, because the text comes from the server. Callers pair it with
 * `router.refresh()`.
 */
export function useLanguage(serverLanguage: Locale) {
  const language = useLanguageStore((state) => state.language);
  const hydrated = useLanguageStore((state) => state.hydrated);
  const { setLanguage } = useLanguageStore.getState();

  return { language: hydrated ? language : serverLanguage, setLanguage };
}

export type { CartItem, Locale, ResolvedTheme, Theme };
