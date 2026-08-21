"use client";

import { create } from "zustand";
import { persist, type PersistStorage } from "zustand/middleware";
import {
  DEFAULT_LOCALE,
  LANGUAGE_COOKIE,
  LANGUAGE_COOKIE_MAX_AGE,
  LANGUAGE_STORAGE_KEY,
  parseLocale,
  type Locale,
} from "@/lib/i18n/locales";
import { normalizePersistedValue } from "./persist-storage";

interface LanguageState {
  /** The stored choice. Uzbek until the persisted value has been read. */
  language: Locale;
  /**
   * False during the first client render so consumers can keep showing what
   * the server sent. Never persisted — it describes this tab's lifecycle, not
   * the visitor's preference.
   */
  hydrated: boolean;
  setLanguage: (language: Locale) => void;
  setHydrated: (hydrated: boolean) => void;
}

type LanguageSlice = Pick<LanguageState, "language">;

const storage: PersistStorage<LanguageSlice> = {
  getItem: (name) =>
    normalizePersistedValue(localStorage.getItem(name), "language") as
      | { state: LanguageSlice }
      | null,
  setItem: (name, value) => localStorage.setItem(name, JSON.stringify(value)),
  removeItem: (name) => localStorage.removeItem(name),
};

/**
 * Mirrors the choice into the cookie the server reads.
 *
 * `SameSite=Lax` rather than `Strict`: a visitor arriving from a search result
 * should land in their own language, and the value is a display preference,
 * not a credential. No `Secure` flag, so it also works over plain http in dev.
 */
export function writeLanguageCookie(language: Locale): void {
  document.cookie = `${LANGUAGE_COOKIE}=${language}; path=/; max-age=${LANGUAGE_COOKIE_MAX_AGE}; samesite=lax`;
}

/**
 * `skipHydration` is what keeps the first client render byte-identical to the
 * server HTML: the store starts at the default on both sides and `LanguageSync`
 * pulls the stored value in from an effect right after mount. This is the same
 * contract the cart, wishlist, compare and theme stores use.
 */
export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: DEFAULT_LOCALE,
      hydrated: false,
      // The cookie is written here rather than at the call site so that every
      // path that changes the language keeps the server's copy in step.
      setLanguage: (language) => {
        writeLanguageCookie(language);
        set({ language });
      },
      setHydrated: (hydrated) => set({ hydrated }),
    }),
    {
      skipHydration: true,
      name: LANGUAGE_STORAGE_KEY,
      storage,
      partialize: (state): LanguageSlice => ({ language: state.language }),
      merge: (persisted, current): LanguageState => ({
        ...current,
        language: parseLocale((persisted as LanguageSlice | undefined)?.language),
      }),
    }
  )
);

/** Called once after mount to load the stored language without a render mismatch. */
export function rehydrateLanguageStore(): void {
  void useLanguageStore.persist.rehydrate();
}
