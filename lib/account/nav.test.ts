import { describe, expect, it } from "vitest";
import {
  ACCOUNT_NAV,
  ACCOUNT_ROOT,
  ACCOUNT_SECTIONS,
  DEFAULT_ACCOUNT_SECTION,
  accountSectionFromPath,
  accountSectionHref,
  isAccountSection,
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

  it("gives every row but the sign-out a destination", () => {
    for (const item of ACCOUNT_NAV) {
      if (item.kind === "logout") {
        expect(item).not.toHaveProperty("href");
      } else {
        expect(item.href.startsWith("/")).toBe(true);
      }
    }
  });

  it("lists every section exactly once in the menu", () => {
    const sections = ACCOUNT_NAV.filter((item) => item.kind === "section").map((item) => item.id);
    expect([...sections].sort()).toEqual([...ACCOUNT_SECTIONS].sort());
  });

  it("serves the default section at the cabinet root and the rest at a slug", () => {
    expect(accountSectionHref(DEFAULT_ACCOUNT_SECTION)).toBe(ACCOUNT_ROOT);
    expect(accountSectionHref("wishlist")).toBe("/account/wishlist");
    expect(accountSectionHref("notifications")).toBe("/account/notifications");
  });

  it("narrows known section ids", () => {
    expect(isAccountSection("orders")).toBe(true);
    // A section since the saved list moved into the cabinet.
    expect(isAccountSection("wishlist")).toBe(true);
    expect(isAccountSection("support")).toBe(false);
  });

  it("reads the active section back off a route", () => {
    expect(accountSectionFromPath("/account/wishlist")).toBe("wishlist");
    expect(accountSectionFromPath("/account/notifications/")).toBe("notifications");
  });

  it("falls back for the root, an unknown slug and a missing path", () => {
    expect(accountSectionFromPath(ACCOUNT_ROOT)).toBe(DEFAULT_ACCOUNT_SECTION);
    expect(accountSectionFromPath("/account/nonsense")).toBe(DEFAULT_ACCOUNT_SECTION);
    expect(accountSectionFromPath(null)).toBe(DEFAULT_ACCOUNT_SECTION);
    // `details` has no route of its own — it is what the root serves.
    expect(accountSectionFromPath("/account/details")).toBe(DEFAULT_ACCOUNT_SECTION);
  });
});
