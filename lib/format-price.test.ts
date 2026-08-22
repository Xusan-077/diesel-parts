import { describe, expect, it } from "vitest";
import { SUPPORTED_LOCALES } from "@/lib/i18n/locales";
import { CURRENCY, formatNumber, formatPrice, parseAmount, sumPrices } from "./format-price";

describe("formatPrice", () => {
  it("groups thousands and appends the local currency word", () => {
    expect(formatPrice(3_450_000, "uz")).toBe("3 450 000 so'm");
    expect(formatPrice(3_450_000, "ru")).toBe("3 450 000 сум");
  });

  it("puts the ISO code first in English", () => {
    expect(formatPrice(3_450_000, "en")).toBe(`${CURRENCY} 3,450,000`);
  });

  it("returns null for an unpriced product", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(formatPrice(null, locale)).toBeNull();
    }
  });

  it("returns null rather than a bogus value for non-finite input", () => {
    expect(formatPrice(Number.NaN, "uz")).toBeNull();
    expect(formatPrice(Number.POSITIVE_INFINITY, "uz")).toBeNull();
  });

  it("formats zero as a real price, not as missing", () => {
    expect(formatPrice(0, "uz")).toBe("0 so'm");
  });

  it("never emits a non-breaking space", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(formatPrice(1_234_567, locale)).not.toMatch(/ /);
    }
  });

  it("groups with a space in uz/ru and a comma in en, regardless of runtime ICU", () => {
    expect(formatPrice(1_234_567, "uz")).toBe("1 234 567 so'm");
    expect(formatPrice(1_234_567, "ru")).toBe("1 234 567 сум");
    expect(formatPrice(1_234_567, "en")).toBe(`${CURRENCY} 1,234,567`);
  });

  it("leaves amounts under a thousand ungrouped", () => {
    expect(formatPrice(999, "uz")).toBe("999 so'm");
  });

  it("rounds fractional amounts", () => {
    expect(formatPrice(1000.4, "uz")).toBe("1 000 so'm");
    expect(formatPrice(1000.6, "uz")).toBe("1 001 so'm");
  });

});

describe("sumPrices", () => {
  it("multiplies each line by its quantity", () => {
    expect(sumPrices([{ price: 1000, quantity: 3 }])).toEqual({ total: 3000, unpriced: 0 });
  });

  it("adds several priced lines", () => {
    const result = sumPrices([
      { price: 1000, quantity: 2 },
      { price: 500, quantity: 4 },
    ]);
    expect(result.total).toBe(4000);
  });

  it("skips unpriced lines and counts them separately", () => {
    const result = sumPrices([
      { price: 1000, quantity: 2 },
      { price: null, quantity: 5 },
      { price: null, quantity: 1 },
    ]);
    expect(result).toEqual({ total: 2000, unpriced: 2 });
  });

  it("returns zeroes for an empty cart", () => {
    expect(sumPrices([])).toEqual({ total: 0, unpriced: 0 });
  });
});

describe("formatNumber", () => {
  it("groups the digits without naming a currency", () => {
    // The price filter's heading already says "so'm"; repeating it inside both
    // ends of the range would double the width of a sidebar control.
    expect(formatNumber(3_450_000, "uz")).toBe("3 450 000");
    expect(formatNumber(3_450_000, "en")).toBe("3,450,000");
  });

  it("leaves a short number alone", () => {
    expect(formatNumber(500, "uz")).toBe("500");
  });
});

describe("parseAmount", () => {
  it("reads back what formatNumber wrote, in any locale", () => {
    expect(parseAmount("3 450 000")).toBe(3_450_000);
    expect(parseAmount("3,450,000")).toBe(3_450_000);
  });

  it("ignores a pasted currency word", () => {
    expect(parseAmount("3450000 so'm")).toBe(3_450_000);
  });

  it("reads an entry with no digits as an open end, not as zero", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("   ")).toBeNull();
    expect(parseAmount("so'm")).toBeNull();
  });

  it("keeps a typed zero, which is a real lower bound", () => {
    expect(parseAmount("0")).toBe(0);
  });
});
