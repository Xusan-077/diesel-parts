import { describe, expect, it } from "vitest";
import {
  ACCOUNT_NAV,
  ACCOUNT_SECTIONS,
  DEFAULT_ACCOUNT_SECTION,
  isAccountSection,
  resolveAccountSection,
} from "./nav";

describe("account nav", () => {
  it("keeps the designed order", () => {
    expect(ACCOUNT_NAV.map((item) => item.id)).toEqual([
      "details",
      "orders",
      "wishlist",
      "reviews",
      "addresses",
      "notifications",
      "support",
      "logout",
    ]);
  });

  it("gives every link a destination and no section one", () => {
    for (const item of ACCOUNT_NAV) {
      if (item.kind === "link") {
        expect(item.href.startsWith("/")).toBe(true);
      } else {
        expect(item).not.toHaveProperty("href");
      }
    }
  });

  it("lists every section exactly once in the menu", () => {
    const sections = ACCOUNT_NAV.filter((item) => item.kind === "section").map((item) => item.id);
    expect([...sections].sort()).toEqual([...ACCOUNT_SECTIONS].sort());
  });

  it("narrows known section ids", () => {
    expect(isAccountSection("orders")).toBe(true);
    expect(isAccountSection("wishlist")).toBe(false);
  });

  it("falls back for a missing or unknown tab", () => {
    expect(resolveAccountSection("notifications")).toBe("notifications");
    expect(resolveAccountSection("nonsense")).toBe(DEFAULT_ACCOUNT_SECTION);
    expect(resolveAccountSection(null)).toBe(DEFAULT_ACCOUNT_SECTION);
  });
});
