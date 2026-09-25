import { describe, expect, it } from "vitest";
import {
  openingSchema,
  closingSchema,
  balanceDifference,
} from "./shift-schema";
describe("shift validation", () => {
  it("requires a finite non-negative opening balance", () => {
    expect(openingSchema.safeParse({ openingBalance: 0 }).success).toBe(true);
    for (const openingBalance of [NaN, Infinity, -1, 1.001])
      expect(openingSchema.safeParse({ openingBalance }).success).toBe(false);
  });
  it.each([90, 110])(
    "requires a non-whitespace comment for actual %s vs expected 100",
    (closingBalanceActual) => {
      expect(
        closingSchema(100).safeParse({ closingBalanceActual, comment: " " })
          .success,
      ).toBe(false);
      expect(
        closingSchema(100).safeParse({
          closingBalanceActual,
          comment: "Sanash farqi",
        }).success,
      ).toBe(true);
    },
  );
  it("accepts matching cash without a comment, avoiding floating point discrepancies", () => {
    expect(
      closingSchema(100).safeParse({ closingBalanceActual: 100, comment: "" })
        .success,
    ).toBe(true);
    expect(balanceDifference(0.3, 0.1 + 0.2)).toBe(0);
  });
});
