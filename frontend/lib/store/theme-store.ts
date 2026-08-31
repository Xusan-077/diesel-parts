"use client";

import { create } from "zustand";
import { persist, type PersistStorage } from "zustand/middleware";
import {
  DEFAULT_THEME,
  normalizePersistedTheme,
  parseTheme,
  resolveTheme,
  THEME_STORAGE_KEY,
  type Theme,
} from "./theme";

interface ThemeState {
  /** The stored preference. */
  theme: Theme;
  /**
   * The operating system preference, written by `ThemeProvider` from a
   * `matchMedia` listener. Never persisted — it belongs to the machine, not
   * to the visitor's choice — and starts false so the first client render
   * matches the light HTML the server sent.
   */
  systemDark: boolean;
  setTheme: (theme: Theme) => void;
  setSystemDark: (systemDark: boolean) => void;
  toggleTheme: () => void;
}

type ThemeSlice = Pick<ThemeState, "theme">;

/**
 * localStorage adapter that also reads the bare `"dark"` string `next-themes`
 * left behind, so an existing preference survives the swap.
 */
const storage: PersistStorage<ThemeSlice> = {
  getItem: (name) =>
    normalizePersistedTheme(localStorage.getItem(name)) as { state: ThemeSlice } | null,
  setItem: (name, value) => localStorage.setItem(name, JSON.stringify(value)),
  removeItem: (name) => localStorage.removeItem(name),
};

/**
 * `skipHydration` is what keeps the first client render byte-identical to the
 * server HTML: the store starts at the default on both sides, and
 * `ThemeProvider` pulls the stored value in from an effect right after mount.
 * This is the same contract the cart, wishlist and compare stores use.
 *
 * The `dark` class still lands before the first paint — see `themeInitScript`
 * in `./theme`, which runs ahead of React and touches only `<html>`, the one
 * element both root layouts mark `suppressHydrationWarning`.
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: DEFAULT_THEME,
      systemDark: false,
      setTheme: (theme) => set({ theme }),
      setSystemDark: (systemDark) => set({ systemDark }),
      // From `system`, the flip is measured against what is on screen, so the
      // button always does the visible opposite of what the visitor sees.
      toggleTheme: () =>
        set((state) => ({
          theme: resolveTheme(state.theme, state.systemDark) === "dark" ? "light" : "dark",
        })),
    }),
    {
      skipHydration: true,
      name: THEME_STORAGE_KEY,
      storage,
      partialize: (state): ThemeSlice => ({ theme: state.theme }),
      merge: (persisted, current): ThemeState => ({
        ...current,
        theme: parseTheme((persisted as ThemeSlice | undefined)?.theme),
      }),
    }
  )
);

/** Called once after mount to load the stored theme without a render mismatch. */
export function rehydrateThemeStore(): void {
  void useThemeStore.persist.rehydrate();
}
