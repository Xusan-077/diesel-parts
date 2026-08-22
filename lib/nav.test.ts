import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { SUPPORTED_LOCALES } from "@/lib/i18n/locales";
import { buildHeaderActions, buildMainNav, isNavItemActive } from "./nav";

/**
 * `(site)` is a route group, so it contributes nothing to the URL: the href and
 * the folder below it line up one to one, with no locale segment in between.
 *
 * A route group can also sit *inside* that folder and is just as invisible —
 * /account is served by `account/(cabinet)/page.tsx`, where the group exists so
 * the sign-in guard in its layout does not also cover /account/verify. So a
 * page one level down inside a parenthesised folder answers the same href.
 */
function routeExists(href: string): boolean {
  const dir = path.join(process.cwd(), "app", "(site)", href.slice(1));
  if (existsSync(path.join(dir, "page.tsx"))) {
    return true;
  }
  if (!existsSync(dir)) {
    return false;
  }

  return readdirSync(dir, { withFileTypes: true }).some(
    (entry) =>
      entry.isDirectory() &&
      entry.name.startsWith("(") &&
      existsSync(path.join(dir, entry.name, "page.tsx"))
  );
}

describe("buildMainNav", () => {
  it("builds locale-free hrefs", () => {
    for (const item of buildMainNav(getDictionary("ru").nav)) {
      expect(item.href).toMatch(/^\/[a-z-]+$/);
    }
  });

  it("points every nav link at a route that actually exists", () => {
    for (const item of buildMainNav(getDictionary("uz").nav)) {
      expect(routeExists(item.href), `missing route for ${item.href}`).toBe(true);
    }
  });

  it("renders the eight main navigation entries with non-empty labels in every locale", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const items = buildMainNav(getDictionary(locale).nav);
      expect(items).toHaveLength(8);
      for (const item of items) {
        expect(item.label.length).toBeGreaterThan(0);
      }
    }
  });

  it("translates the labels without touching the hrefs", () => {
    const uz = buildMainNav(getDictionary("uz").nav);
    const ru = buildMainNav(getDictionary("ru").nav);
    expect(ru.map((item) => item.href)).toEqual(uz.map((item) => item.href));
    expect(ru.map((item) => item.label)).not.toEqual(uz.map((item) => item.label));
  });
});

describe("buildHeaderActions", () => {
  it("points every header icon at a route that actually exists", () => {
    for (const action of buildHeaderActions(getDictionary("uz").header)) {
      expect(routeExists(action.href), `missing route for ${action.href}`).toBe(true);
    }
  });

  it("labels all four actions in every locale", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const actions = buildHeaderActions(getDictionary(locale).header);
      expect(actions).toHaveLength(4);
      for (const action of actions) {
        expect(action.label.length).toBeGreaterThan(0);
        expect(action.href).toMatch(/^\/[a-z-]+$/);
      }
    }
  });

  it("uses unique keys so counts cannot be mapped to the wrong icon", () => {
    const keys = buildHeaderActions(getDictionary("uz").header).map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("isNavItemActive", () => {
  it("matches the exact path", () => {
    expect(isNavItemActive("/products", "/products")).toBe(true);
  });

  it("matches nested paths under the link", () => {
    expect(isNavItemActive("/products/filter-123", "/products")).toBe(true);
  });

  it("does not match a sibling path sharing a prefix", () => {
    expect(isNavItemActive("/products-archive", "/products")).toBe(false);
  });

  it("does not match an unrelated route", () => {
    expect(isNavItemActive("/brands", "/products")).toBe(false);
  });
});
