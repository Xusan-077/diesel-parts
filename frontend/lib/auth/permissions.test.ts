import { describe, expect, it } from "vitest";
import { can } from "./permissions";

describe("can", () => {
  it("grants DIRECTOR every permission", () => {
    expect(can("DIRECTOR", "finance:read")).toBe(true);
    expect(can("DIRECTOR", "audit:read")).toBe(true);
    expect(can("DIRECTOR", "users:delete")).toBe(true);
  });

  it("grants SELLER the spec allow-list", () => {
    expect(can("SELLER", "orders:create")).toBe(true);
    expect(can("SELLER", "reviews:read")).toBe(true);
    expect(can("SELLER", "warehouse:read")).toBe(true);
  });

  it("denies SELLER the director-only modules and actions", () => {
    expect(can("SELLER", "finance:read")).toBe(false);
    expect(can("SELLER", "analytics:read")).toBe(false);
    expect(can("SELLER", "users:read")).toBe(false);
    expect(can("SELLER", "audit:read")).toBe(false);
    expect(can("SELLER", "discounts:approve")).toBe(false);
  });

  it("denies SELLER the two deliberately director-only delete keys", () => {
    expect(can("SELLER", "products:delete")).toBe(false);
    expect(can("SELLER", "customers:delete")).toBe(false);
  });
});
