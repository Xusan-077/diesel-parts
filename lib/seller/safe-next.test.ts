import { describe, expect, it } from "vitest";
import { safeSellerNext } from "./safe-next";

describe("safeSellerNext", () => {
  it("accepts a path inside the seller panel", () => {
    expect(safeSellerNext("/seller/orders/123")).toBe("/seller/orders/123");
  });

  it("rejects a path outside /seller", () => {
    expect(safeSellerNext("/admin")).toBeNull();
    expect(safeSellerNext("/")).toBeNull();
  });

  it("rejects a protocol-relative URL used to leave the site", () => {
    expect(safeSellerNext("//evil.example/seller")).toBeNull();
  });

  it("rejects non-string input", () => {
    expect(safeSellerNext(undefined)).toBeNull();
    expect(safeSellerNext(null)).toBeNull();
    expect(safeSellerNext(["/seller"])).toBeNull();
  });
});
