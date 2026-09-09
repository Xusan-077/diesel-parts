import { describe, expect, it } from "vitest";
import { computeReceiptTotals, lineTotal } from "./receipt-totals";

describe("lineTotal", () => {
  it("multiplies quantity by unit cost", () => {
    expect(lineTotal({ quantity: 3, unitCost: 125_000 })).toBe(375_000);
  });

  it("treats a half-typed number as zero", () => {
    expect(lineTotal({ quantity: Number.NaN, unitCost: 100 })).toBe(0);
  });
});

describe("computeReceiptTotals", () => {
  it("sums the lines, then subtracts discount and adds tax", () => {
    const totals = computeReceiptTotals(
      [
        { quantity: 10, unitCost: 100_000 },
        { quantity: 2, unitCost: 50_000 },
      ],
      100_000,
      30_000,
    );
    expect(totals).toEqual({ subtotal: 1_100_000, total: 1_030_000 });
  });

  it("ignores a negative or non-finite discount / tax", () => {
    const totals = computeReceiptTotals([{ quantity: 1, unitCost: 200 }], -5, Number.NaN);
    expect(totals).toEqual({ subtotal: 200, total: 200 });
  });

  it("is zero for an empty line set", () => {
    expect(computeReceiptTotals([], 0, 0)).toEqual({ subtotal: 0, total: 0 });
  });
});
