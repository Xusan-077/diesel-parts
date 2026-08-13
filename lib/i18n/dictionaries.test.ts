import { describe, expect, it } from "vitest";
import { getDictionary, hasLocale } from "./dictionaries";

function collectKeyPaths(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) {
    return collectKeyPaths(value[0] ?? {}, prefix);
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, v]) =>
      collectKeyPaths(v, prefix ? `${prefix}.${key}` : key)
    );
  }
  return [prefix];
}

describe("dictionaries", () => {
  it("hasLocale narrows supported locale strings", () => {
    expect(hasLocale("uz")).toBe(true);
    expect(hasLocale("xx")).toBe(false);
  });

  it("getDictionary returns the matching locale's content", () => {
    expect(getDictionary("en").meta.siteName).toBe("DieselParts");
    expect(getDictionary("uz").nav.products).toBe("Mahsulotlar");
    expect(getDictionary("ru").nav.products).toBe("Продукция");
  });

  it("falls back to the default locale for an unsupported locale", () => {
    expect(getDictionary("xx").meta.siteName).toBe("DieselParts");
  });

  it("uz, ru, and en dictionaries have identical key structure", () => {
    const uzKeys = collectKeyPaths(getDictionary("uz")).sort();
    const ruKeys = collectKeyPaths(getDictionary("ru")).sort();
    const enKeys = collectKeyPaths(getDictionary("en")).sort();
    expect(ruKeys).toEqual(uzKeys);
    expect(enKeys).toEqual(uzKeys);
  });
});
