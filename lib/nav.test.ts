import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { SUPPORTED_LOCALES } from "@/lib/i18n/locales";
import { buildHeaderActions, buildMainNav, isNavItemActive } from "./nav";

function routeExists(href: string): boolean {
  const segment = href.replace(/^\/uz\//, "");
  return existsSync(path.join(process.cwd(), "app", "[lang]", segment, "page.tsx"));
}

describe("buildMainNav", () => {
  it("prefixes every href with the active locale", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const items = buildMainNav(locale, getDictionary(locale).nav);
      for (const item of items) {
        expect(item.href.startsWith(`/${locale}/`)).toBe(true);
      }
    }
  });

  it("points every nav link at a route that actually exists", () => {
    for (const item of buildMainNav("uz", getDictionary("uz").nav)) {
      expect(routeExists(item.href), `missing route for ${item.href}`).toBe(true);
    }
  });

  it("renders the eight main navigation entries with non-empty labels in every locale", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const items = buildMainNav(locale, getDictionary(locale).nav);
      expect(items).toHaveLength(8);
      for (const item of items) {
        expect(item.label.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("buildHeaderActions", () => {
  it("points every header icon at a route that actually exists", () => {
    for (const action of buildHeaderActions("uz", getDictionary("uz").header)) {
      expect(routeExists(action.href), `missing route for ${action.href}`).toBe(true);
    }
  });

  it("labels all four actions in every locale", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const actions = buildHeaderActions(locale, getDictionary(locale).header);
      expect(actions).toHaveLength(4);
      for (const action of actions) {
        expect(action.label.length).toBeGreaterThan(0);
        expect(action.href.startsWith(`/${locale}/`)).toBe(true);
      }
    }
  });

  it("uses unique keys so counts cannot be mapped to the wrong icon", () => {
    const keys = buildHeaderActions("uz", getDictionary("uz").header).map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("isNavItemActive", () => {
  it("matches the exact path", () => {
    expect(isNavItemActive("/uz/products", "/uz/products")).toBe(true);
  });

  it("matches nested paths under the link", () => {
    expect(isNavItemActive("/uz/products/filter-123", "/uz/products")).toBe(true);
  });

  it("does not match a sibling path sharing a prefix", () => {
    expect(isNavItemActive("/uz/products-archive", "/uz/products")).toBe(false);
  });

  it("does not match a different locale", () => {
    expect(isNavItemActive("/ru/products", "/uz/products")).toBe(false);
  });
});
