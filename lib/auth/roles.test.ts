import { describe, expect, it } from "vitest";
import { adminHomePath, canAccessAdminPath, isAdminPath, isDirectorPath } from "./roles";

describe("isAdminPath", () => {
  it("matches the panel root and everything under it", () => {
    expect(isAdminPath("/admin")).toBe(true);
    expect(isAdminPath("/admin/")).toBe(true);
    expect(isAdminPath("/admin/seller/orders")).toBe(true);
  });

  it("does not match a path that merely starts with the same letters", () => {
    expect(isAdminPath("/administrator")).toBe(false);
    expect(isAdminPath("/blog/admin")).toBe(false);
    expect(isAdminPath("/")).toBe(false);
  });

  it("does not match the director panel — a separate root, not a subtree", () => {
    expect(isAdminPath("/director")).toBe(false);
    expect(isAdminPath("/director/products")).toBe(false);
  });
});

describe("isDirectorPath", () => {
  it("matches the director root and everything under it", () => {
    expect(isDirectorPath("/director")).toBe(true);
    expect(isDirectorPath("/director/")).toBe(true);
    expect(isDirectorPath("/director/products")).toBe(true);
  });

  it("does not match a path that merely starts with the same letters", () => {
    expect(isDirectorPath("/directory")).toBe(false);
    expect(isDirectorPath("/blog/director")).toBe(false);
  });

  it("does not match the admin panel", () => {
    expect(isDirectorPath("/admin")).toBe(false);
    expect(isDirectorPath("/admin/seller")).toBe(false);
  });
});

describe("adminHomePath", () => {
  it("sends each role to its own area", () => {
    expect(adminHomePath("DIRECTOR")).toBe("/director");
    expect(adminHomePath("SELLER")).toBe("/admin/seller");
  });
});

describe("canAccessAdminPath", () => {
  it("opens the seller area to both roles, so a director can support a seller", () => {
    expect(canAccessAdminPath("/admin/seller/inquiries", "SELLER")).toBe(true);
    expect(canAccessAdminPath("/admin/seller/inquiries", "DIRECTOR")).toBe(true);
  });

  it("lets either role hit the signpost at /admin", () => {
    expect(canAccessAdminPath("/admin", "SELLER")).toBe(true);
    expect(canAccessAdminPath("/admin/", "DIRECTOR")).toBe(true);
  });

  it("treats a longer segment as a different area, not a prefix match", () => {
    expect(canAccessAdminPath("/admin/sellers", "SELLER")).toBe(false);
    expect(canAccessAdminPath("/admin/sellers", "DIRECTOR")).toBe(false);
  });

  it("denies an unlisted subtree for every role, so new pages fail closed", () => {
    expect(canAccessAdminPath("/admin/reports", "DIRECTOR")).toBe(false);
    expect(canAccessAdminPath("/admin/reports", "SELLER")).toBe(false);
    // The director area used to live here; it is a separate root now (see
    // isDirectorPath above), so this table has no entry for it any more.
    expect(canAccessAdminPath("/admin/director", "DIRECTOR")).toBe(false);
  });

  it("ignores a trailing slash", () => {
    expect(canAccessAdminPath("/admin/seller/", "SELLER")).toBe(true);
  });
});
