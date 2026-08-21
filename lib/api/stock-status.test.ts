import { describe, expect, it } from "vitest";
import { deriveStockStatus } from "./stock-status";

describe("deriveStockStatus", () => {
  it("reports out_of_stock at zero", () => {
    expect(deriveStockStatus(0, 5)).toBe("out_of_stock");
  });

  it("reports out_of_stock for negative stock, which a bad adjustment can produce", () => {
    expect(deriveStockStatus(-2, 5)).toBe("out_of_stock");
  });

  it("reports limited at exactly minStock", () => {
    expect(deriveStockStatus(5, 5)).toBe("limited");
  });

  it("reports limited just above zero", () => {
    expect(deriveStockStatus(1, 5)).toBe("limited");
  });

  it("reports available one above minStock", () => {
    expect(deriveStockStatus(6, 5)).toBe("available");
  });

  it("treats a zero minStock as available for any positive stock", () => {
    expect(deriveStockStatus(1, 0)).toBe("available");
  });
});
