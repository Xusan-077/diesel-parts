import { describe, expect, it } from "vitest";
import { applyDiscount, roundMoney, subtotalOf } from "./order-money";

describe("roundMoney", () => {
  it("keeps two decimals, which is what the column holds", () => {
    expect(roundMoney(1234.5678)).toBe(1234.57);
  });

  it("rounds a half up rather than leaving it to binary floating point", () => {
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(2.675)).toBe(2.68);
  });

  it("leaves an already-exact figure alone", () => {
    expect(roundMoney(100)).toBe(100);
    expect(roundMoney(0)).toBe(0);
  });
});

describe("subtotalOf", () => {
  it("sums quantity times price across the lines", () => {
    expect(
      subtotalOf([
        { qty: 2, unitPrice: 1500 },
        { qty: 3, unitPrice: 1000 },
      ]),
    ).toBe(6000);
  });

  it("returns zero for an order with no lines", () => {
    expect(subtotalOf([])).toBe(0);
  });

  it("rounds the total, not each line, and never leaves a float tail", () => {
    expect(subtotalOf([{ qty: 3, unitPrice: 0.1 }])).toBe(0.3);
  });
});

describe("applyDiscount", () => {
  it("returns the subtotal untouched at 0%", () => {
    expect(applyDiscount(1000, 0)).toBe(1000);
  });

  it("takes the percent off", () => {
    expect(applyDiscount(1000, 5)).toBe(950);
    expect(applyDiscount(2500, 12.5)).toBe(2187.5);
  });

  it("returns zero at 100%", () => {
    expect(applyDiscount(1000, 100)).toBe(0);
  });

  it("rounds to two decimals, so the seller is quoted what gets stored", () => {
    expect(applyDiscount(99.99, 7)).toBe(92.99);
  });
});
