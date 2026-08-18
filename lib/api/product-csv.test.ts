import { describe, expect, it } from "vitest";
import { parseCsv, parseProductCsv, toCsv, type CsvProduct } from "./product-csv";

function product(overrides: Partial<CsvProduct> = {}): CsvProduct {
  return {
    sku: "DP-INJ-3126",
    slug: "cat-fuel-injector-3126",
    oemNumbers: ["127-8213", "127-8214"],
    name: { uz: "Forsunka", ru: "Форсунка", en: "Injector" },
    description: { uz: "uz", ru: "ru", en: "en" },
    price: 3450000,
    stock: 25,
    minStock: 5,
    categoryId: "injector",
    brandId: "cat",
    compatibleModels: ["CAT 320D"],
    specs: [],
    imageLabels: ["Front"],
    isActive: true,
    ...overrides,
  };
}

describe("toCsv", () => {
  it("opens with a byte order mark so Excel reads Cyrillic correctly", () => {
    expect(toCsv([product()]).charCodeAt(0)).toBe(0xfeff);
  });

  it("joins multi-valued cells with a semicolon", () => {
    expect(toCsv([product()])).toContain("127-8213;127-8214");
  });

  it("quotes a cell containing a comma and doubles inner quotes", () => {
    const csv = toCsv([product({ name: { uz: 'A, B "C"', ru: "r", en: "e" } })]);
    expect(csv).toContain('"A, B ""C"""');
  });

  it("writes an unpriced product as an empty cell, never zero", () => {
    const csv = toCsv([product({ price: null })]);
    expect(csv).not.toContain(",0,");
    expect(csv.split("\r\n")[1]).toContain(",,25,");
  });
});

describe("parseCsv", () => {
  it("round-trips a quoted cell with a comma", () => {
    expect(parseCsv('a,"b,c",d')).toEqual([["a", "b,c", "d"]]);
  });

  it("round-trips an escaped quote", () => {
    expect(parseCsv('a,"say ""hi""",c')).toEqual([["a", 'say "hi"', "c"]]);
  });

  it("keeps a newline inside a quoted cell", () => {
    expect(parseCsv('a,"line1\nline2"')).toEqual([["a", "line1\nline2"]]);
  });

  it("drops blank lines", () => {
    expect(parseCsv("a,b\n\nc,d\n")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });
});

describe("parseProductCsv", () => {
  it("round-trips what toCsv wrote", () => {
    const result = parseProductCsv(toCsv([product()]));

    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].sku).toBe("DP-INJ-3126");
    expect(result.rows[0].oemNumbers).toEqual(["127-8213", "127-8214"]);
    expect(result.rows[0].price).toBe(3450000);
  });

  it("carries the id through so an export can be edited and re-imported", () => {
    const result = parseProductCsv(toCsv([product({ id: "abc-123" })]));
    expect(result.rows[0].id).toBe("abc-123");
  });

  it("treats a row with no id as new", () => {
    const result = parseProductCsv(toCsv([product()]));
    expect(result.rows[0].id).toBeUndefined();
  });

  it("names the missing columns rather than failing row by row", () => {
    const result = parseProductCsv("sku,slug\nDP-1,a-b");
    expect(result.rows).toEqual([]);
    expect(result.errors[0].message).toContain("nameUz");
  });

  it("reports every bad row with its line number and keeps the good ones", () => {
    const csv = toCsv([product(), product({ sku: "", slug: "second-one" })]);
    const result = parseProductCsv(csv);

    expect(result.rows).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].line).toBe(3);
    expect(result.errors[0].message).toContain("sku");
  });

  it("rejects a slug that is not url-safe", () => {
    const result = parseProductCsv(toCsv([product({ slug: "Not A Slug" })]));
    expect(result.errors[0].message).toContain("slug");
  });

  it("reads isActive=0 as retired and anything else as live", () => {
    const off = parseProductCsv(toCsv([product({ isActive: false })]));
    const on = parseProductCsv(toCsv([product({ isActive: true })]));

    expect(off.rows[0].isActive).toBe(false);
    expect(on.rows[0].isActive).toBe(true);
  });

  it("reports an empty file rather than importing nothing silently", () => {
    expect(parseProductCsv("").errors[0].message).toContain("bo'sh");
  });
});
