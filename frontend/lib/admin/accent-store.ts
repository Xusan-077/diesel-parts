"use client";

import { create } from "zustand";
import { persist, type PersistStorage } from "zustand/middleware";
import {
  ACCENT_STORAGE_KEY,
  DEFAULT_ACCENT,
  normalizePersistedAccent,
  parseAccent,
  type Accent,
} from "./accent";

interface AccentState {
  accent: Accent;
  setAccent: (accent: Accent) => void;
}

type AccentSlice = Pick<AccentState, "accent">;

const storage: PersistStorage<AccentSlice> = {
  getItem: (name) =>
    normalizePersistedAccent(localStorage.getItem(name)) as { state: AccentSlice } | null,
  setItem: (name, value) => localStorage.setItem(name, JSON.stringify(value)),
  removeItem: (name) => localStorage.removeItem(name),
};

/**
 * `skipHydration`, like every other persisted store in this codebase: the
 * store starts at the default on both sides of the render so the first client
 * pass is byte-identical to the server HTML, and `PanelChromeSync` pulls the
 * stored value in from an effect after mount.
 *
 * The attribute itself is already correct before any of that — see
 * `accentInitScript`, which runs ahead of React and touches only `<html>`.
 */
export const useAccentStore = create<AccentState>()(
  persist(
    (set) => ({
      accent: DEFAULT_ACCENT,
      setAccent: (accent) => set({ accent }),
    }),
    {
      skipHydration: true,
      name: ACCENT_STORAGE_KEY,
      storage,
      partialize: (state): AccentSlice => ({ accent: state.accent }),
      merge: (persisted, current): AccentState => ({
        ...current,
        accent: parseAccent((persisted as AccentSlice | undefined)?.accent),
      }),
    },
  ),
);

export function rehydrateAccentStore(): void {
  void useAccentStore.persist.rehydrate();
}
