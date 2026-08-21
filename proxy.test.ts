import { describe, expect, it } from "vitest";
import { isSkipped } from "./proxy";

/**
 * These guard a bug that was invisible from the outside: the `config.matcher`
 * regex this file used to carry matched only `/`, so nothing below it ever ran
 * anywhere else. The filter replacing it is worth pinning.
 */
describe("isSkipped", () => {
  it("skips framework paths", () => {
    expect(isSkipped("/_next/static/chunk.js")).toBe(true);
    expect(isSkipped("/api/v1/auth/login")).toBe(true);
    expect(isSkipped("/api")).toBe(true);
  });

  it("skips files in public/", () => {
    expect(isSkipped("/favicon.ico")).toBe(true);
    expect(isSkipped("/images/logo.svg")).toBe(true);
  });

  it("does not skip routes", () => {
    expect(isSkipped("/")).toBe(false);
    expect(isSkipped("/contact")).toBe(false);
    expect(isSkipped("/products")).toBe(false);
    expect(isSkipped("/admin/seller")).toBe(false);
  });

  it("does not skip a route that merely starts with the same letters", () => {
    expect(isSkipped("/apidocs")).toBe(false);
    expect(isSkipped("/_nextsteps")).toBe(false);
  });
});
