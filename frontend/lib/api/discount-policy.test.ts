import { describe, expect, it } from "vitest";
import { classifyDiscount, DIRECTOR_DISCOUNT_LIMIT } from "./discount-policy";

describe("classifyDiscount", () => {
  it("applies a discount below the seller's limit at once", () => {
    expect(classifyDiscount(3, 5)).toEqual({ kind: "immediate" });
  });

  it("treats the limit itself as inside it", () => {
    // A 5% ceiling that refuses 5% would read as a 4.99% ceiling to everyone
    // using it.
    expect(classifyDiscount(5, 5)).toEqual({ kind: "immediate" });
  });

  it("sends anything above the limit to the director", () => {
    expect(classifyDiscount(5.01, 5)).toEqual({ kind: "needs_approval" });
    expect(classifyDiscount(20, 5)).toEqual({ kind: "needs_approval" });
  });

  it("lets a zero limit through only for no discount at all", () => {
    expect(classifyDiscount(0, 0)).toEqual({ kind: "immediate" });
    expect(classifyDiscount(0.5, 0)).toEqual({ kind: "needs_approval" });
  });

  it("never asks a director for approval, since they are the approval path", () => {
    expect(classifyDiscount(100, DIRECTOR_DISCOUNT_LIMIT)).toEqual({ kind: "immediate" });
  });
});
