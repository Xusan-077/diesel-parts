import { describe, expect, it } from "vitest";
import { adminHomePath, canAccessAdminPath, isAdminPath } from "./roles";

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
});

describe("adminHomePath", () => {
  it("sends each role to its own area", () => {
    expect(adminHomePath("DIRECTOR")).toBe("/admin/director");
    expect(adminHomePath("SELLER")).toBe("/admin/seller");
  });
});

describe("canAccessAdminPath", () => {
  it("keeps sellers out of the director area", () => {
    expect(canAccessAdminPath("/admin/director", "SELLER")).toBe(false);
    expect(canAccessAdminPath("/admin/director/analytics", "SELLER")).toBe(false);
  });

  it("lets a director into the director area", () => {
    expect(canAccessAdminPath("/admin/director", "DIRECTOR")).toBe(true);
    expect(canAccessAdminPath("/admin/director/users/new", "DIRECTOR")).toBe(true);
  });

  it("opens the seller area to both roles, so a director can support a seller", () => {
    expect(canAccessAdminPath("/admin/seller/inquiries", "SELLER")).toBe(true);
    expect(canAccessAdminPath("/admin/seller/inquiries", "DIRECTOR")).toBe(true);
  });

  it("lets either role hit the signpost at /admin", () => {
    expect(canAccessAdminPath("/admin", "SELLER")).toBe(true);
    expect(canAccessAdminPath("/admin/", "DIRECTOR")).toBe(true);
  });

  it("treats a longer segment as a different area, not a prefix match", () => {
    expect(canAccessAdminPath("/admin/directory", "SELLER")).toBe(false);
    expect(canAccessAdminPath("/admin/directory", "DIRECTOR")).toBe(false);
  });

  it("denies an unlisted subtree for every role, so new pages fail closed", () => {
    expect(canAccessAdminPath("/admin/reports", "DIRECTOR")).toBe(false);
    expect(canAccessAdminPath("/admin/reports", "SELLER")).toBe(false);
  });

  it("ignores a trailing slash", () => {
    expect(canAccessAdminPath("/admin/seller/", "SELLER")).toBe(true);
    expect(canAccessAdminPath("/admin/director/", "SELLER")).toBe(false);
  });
});
