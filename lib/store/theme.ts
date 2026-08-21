import { normalizePersistedValue, type PersistedEnvelope } from "./persist-storage";

/** What the visitor chose. `system` defers to the operating system. */
export type Theme = "light" | "dark" | "system";

/** What actually gets painted once `system` has been resolved. */
export type ResolvedTheme = "light" | "dark";

/**
 * No stored choice means follow the operating system, which is what a visitor
 * who set their machine to dark already expects everywhere else.
 */
export const DEFAULT_THEME: Theme = "system";

/**
 * The same key `next-themes` wrote to, deliberately. Keeping it means a
 * visitor who already chose dark keeps that choice across this swap instead of
 * being silently reset.
 */
export const THEME_STORAGE_KEY = "theme";

/** The class the `dark` Tailwind variant keys off (see app/globals.css). */
export const DARK_CLASS = "dark";

/** The query the `system` theme follows. */
export const DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

/** Anything unrecognised falls back to the default. */
export function parseTheme(value: unknown): Theme {
  return isTheme(value) ? value : DEFAULT_THEME;
}

/** Collapses the three-state preference into the two states the DOM has. */
export function resolveTheme(theme: Theme, systemDark: boolean): ResolvedTheme {
  if (theme === "system") {
    return systemDark ? "dark" : "light";
  }

  return theme;
}

/** Reads the operating system preference. Safe to call before mount. */
export function prefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia(DARK_MEDIA_QUERY).matches;
}

/**
 * Normalises a raw localStorage string into the envelope `zustand/persist`
 * expects, tolerating the two formats that can be on disk:
 *
 *  - `dark`                              — what `next-themes` wrote, a bare
 *                                          word that is not valid JSON
 *  - `{"state":{"theme":"dark"},...}`    — what persist writes
 *
 * The legacy check must come first: `JSON.parse("dark")` throws, so without it
 * every existing dark-mode visitor would be reset on their next load.
 */
export function normalizePersistedTheme(raw: string | null): PersistedEnvelope | null {
  if (isTheme(raw)) {
    return { state: { theme: raw } };
  }

  return normalizePersistedValue(raw, "theme");
}

/**
 * The single place the DOM is touched. Called from the provider on every
 * change, including the one that lands when the stored value is rehydrated.
 */
export function applyThemeClass(
  theme: ResolvedTheme,
  root: HTMLElement = document.documentElement
): void {
  root.classList.toggle(DARK_CLASS, theme === "dark");
}

/**
 * The blocking script that puts the `dark` class on `<html>` before the first
 * paint, so a dark-mode visitor never sees a white flash. It has to duplicate
 * the reading logic above because it runs before any bundle is parsed — the
 * constants are interpolated rather than retyped so the two cannot drift.
 *
 * Both root layouts carry `suppressHydrationWarning` on `<html>`; without it
 * React would report the class this script added as a hydration mismatch.
 */
export function themeInitScript(): string {
  const key = JSON.stringify(THEME_STORAGE_KEY);
  const fallback = JSON.stringify(DEFAULT_THEME);
  const darkClass = JSON.stringify(DARK_CLASS);
  const query = JSON.stringify(DARK_MEDIA_QUERY);

  return `(function(){try{var v=function(t){return t==="light"||t==="dark"||t==="system"?t:null};var r=localStorage.getItem(${key});var t=v(r);if(!t&&r){try{var p=JSON.parse(r);t=v(p&&p.state&&p.state.theme)}catch(e){}}if(!t){t=${fallback}}var d=t==="dark"||(t==="system"&&window.matchMedia(${query}).matches);document.documentElement.classList.toggle(${darkClass},d)}catch(e){}})()`;
}
