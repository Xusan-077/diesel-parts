import { describe, expect, it } from "vitest";
import { formatMoney, formatPercent } from "./format";

/** Intl's uz-UZ grouping separator character varies by ICU data version, so assertions normalize whitespace instead of pinning one byte. */
function normalizeSpaces(value: string): string {
  return value.replace(/\s/g, " ");
}

describe("formatMoney", () => {
  it("formats a Decimal-as-string amount (backend's Prisma Decimal serializes to a JSON string)", () => {
    expect(normalizeSpaces(formatMoney("1450000"))).toBe("1 450 000 so'm");
  });

  it("formats a plain number the same way", () => {
    expect(normalizeSpaces(formatMoney(1450000))).toBe("1 450 000 so'm");
  });

  it("falls back to zero for a non-numeric string instead of rendering NaN", () => {
    expect(formatMoney("not-a-number")).toBe("0 so'm");
  });
});

describe("formatPercent", () => {
  it("prefixes a positive change with a plus sign", () => {
    expect(formatPercent(12.34)).toBe("+12.3%");
  });

  it("leaves a negative change with its own minus sign", () => {
    expect(formatPercent(-5)).toBe("-5.0%");
  });

  it("does not sign a zero change", () => {
    expect(formatPercent(0)).toBe("0.0%");
  });
});
