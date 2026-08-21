import { describe, expect, it } from "vitest";
import {
  applyThemeClass,
  DEFAULT_THEME,
  normalizePersistedTheme,
  parseTheme,
  resolveTheme,
  themeInitScript,
  THEME_STORAGE_KEY,
} from "./theme";

describe("parseTheme", () => {
  it("keeps the three real preferences", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("system")).toBe("system");
  });

  it("falls back for anything else", () => {
    expect(parseTheme("sepia")).toBe(DEFAULT_THEME);
    expect(parseTheme(undefined)).toBe(DEFAULT_THEME);
    expect(parseTheme(null)).toBe(DEFAULT_THEME);
    expect(parseTheme(7)).toBe(DEFAULT_THEME);
  });
});

describe("resolveTheme", () => {
  it("passes an explicit choice through, whatever the machine says", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("follows the machine for system", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});

describe("normalizePersistedTheme", () => {
  it("reads the bare word next-themes wrote, which is not valid JSON", () => {
    expect(normalizePersistedTheme("dark")).toEqual({ state: { theme: "dark" } });
    expect(normalizePersistedTheme("light")).toEqual({ state: { theme: "light" } });
    expect(normalizePersistedTheme("system")).toEqual({ state: { theme: "system" } });
  });

  it("reads the zustand envelope", () => {
    const raw = JSON.stringify({ state: { theme: "dark" }, version: 0 });
    expect(normalizePersistedTheme(raw)).toEqual({ state: { theme: "dark" } });
  });

  it("returns null when nothing is stored or the value is corrupt", () => {
    expect(normalizePersistedTheme(null)).toBeNull();
    expect(normalizePersistedTheme("{not json")).toBeNull();
    expect(normalizePersistedTheme(JSON.stringify({ nope: 1 }))).toBeNull();
  });
});

describe("the storage key", () => {
  it("is the one next-themes used, so an existing choice is not reset", () => {
    expect(THEME_STORAGE_KEY).toBe("theme");
  });
});

describe("applyThemeClass", () => {
  function element() {
    // A bare object with the class API is enough here; the DOM-backed path is
    // covered by the provider test.
    const classes = new Set<string>();
    return {
      classes,
      element: {
        classList: {
          toggle: (name: string, force: boolean) => {
            if (force) {
              classes.add(name);
            } else {
              classes.delete(name);
            }
          },
        },
      } as unknown as HTMLElement,
    };
  }

  it("adds the dark class and takes it away again", () => {
    const { classes, element: root } = element();

    applyThemeClass("dark", root);
    expect(classes.has("dark")).toBe(true);

    applyThemeClass("light", root);
    expect(classes.has("dark")).toBe(false);
  });
});

/*
 * The pre-paint script is a string, so nothing type-checks it. Running it
 * against a stand-in document is the only way to catch a typo before a
 * visitor does — and a throwing script would leave the page unstyled.
 */
describe("themeInitScript", () => {
  function run(stored: string | null, systemDark: boolean): boolean {
    const classes = new Set<string>();
    const scope = {
      localStorage: { getItem: () => stored },
      document: {
        documentElement: {
          classList: {
            toggle: (name: string, force: boolean) =>
              force ? classes.add(name) : classes.delete(name),
          },
        },
      },
      window: { matchMedia: () => ({ matches: systemDark }) },
    };

    const args = Object.keys(scope);
    const values = Object.values(scope);
    new Function(...args, themeInitScript())(...values);

    return classes.has("dark");
  }

  it("applies a stored explicit choice", () => {
    expect(run(JSON.stringify({ state: { theme: "dark" } }), false)).toBe(true);
    expect(run(JSON.stringify({ state: { theme: "light" } }), true)).toBe(false);
  });

  it("applies the bare word next-themes left behind", () => {
    expect(run("dark", false)).toBe(true);
    expect(run("light", true)).toBe(false);
  });

  it("follows the machine when nothing is stored", () => {
    expect(run(null, true)).toBe(true);
    expect(run(null, false)).toBe(false);
  });

  it("falls back to the machine on a corrupt value instead of throwing", () => {
    expect(run("{not json", true)).toBe(true);
    expect(run("{not json", false)).toBe(false);
  });
});
