import { describe, expect, it } from "vitest";
import { toBackendStockStatus, toProduct, toRootStockStatus, type ProductRow } from "./product-mapper";

function row(overrides: Partial<ProductRow> = {}): ProductRow {
  return {
    id: "cat-injector-3126",
    slug: "cat-fuel-injector-3126",
    sku: "DP-INJ-3126",
    oemNumbers: ["127-8213"],
    nameUz: "Forsunka",
    nameRu: "Форсунка",
    nameEn: "Injector",
    descriptionUz: "uz",
    descriptionRu: "ru",
    descriptionEn: "en",
    // Decimal columns serialize as a numeric string over the wire, never a number.
    price: "3450000.00",
    stockStatus: "IN_STOCK",
    categoryId: "injector",
    brandId: "cat",
    compatibleModels: ["CAT 320D"],
    specs: [{ label: { uz: "a", ru: "b", en: "c" }, value: "Steel" }],
    imageUrl: null,
    ...overrides,
  };
}

describe("toProduct", () => {
  it("converts the wire-format Decimal string to a plain number", () => {
    const product = toProduct(row());
    expect(product.price).toBe(3450000);
    expect(typeof product.price).toBe("number");
  });

  it("keeps a null price null rather than coercing it to zero", () => {
    expect(toProduct(row({ price: null })).price).toBeNull();
  });

  it("gathers the three name columns into LocalizedText", () => {
    expect(toProduct(row()).name).toEqual({ uz: "Forsunka", ru: "Форсунка", en: "Injector" });
  });

  it("gathers the three description columns into LocalizedText", () => {
    expect(toProduct(row()).description).toEqual({ uz: "uz", ru: "ru", en: "en" });
  });

  it("translates backend/'s stock status enum to root's own vocabulary", () => {
    expect(toProduct(row({ stockStatus: "IN_STOCK" })).stockStatus).toBe("available");
    expect(toProduct(row({ stockStatus: "LOW_STOCK" })).stockStatus).toBe("limited");
    expect(toProduct(row({ stockStatus: "OUT_OF_STOCK" })).stockStatus).toBe("out_of_stock");
  });

  it("defaults specs to an empty array rather than crashing on backend/'s default {} object", () => {
    // backend/prisma/schema.prisma's Product.specs defaults to the JSON
    // object "{}", not "[]" — a product whose specs were never edited comes
    // back this way and used to crash SpecsTable's .map().
    expect(toProduct(row({ specs: {} })).specs).toEqual([]);
    expect(toProduct(row({ specs: null })).specs).toEqual([]);
    expect(toProduct(row({ specs: undefined })).specs).toEqual([]);
  });

  it("keeps a real specs array intact", () => {
    const specs = [{ label: { uz: "a", ru: "b", en: "c" }, value: "Steel" }];
    expect(toProduct(row({ specs })).specs).toEqual(specs);
  });

  it("does not leak the raw name columns", () => {
    const product = toProduct(row());
    expect(product).not.toHaveProperty("nameUz");
  });

  it("passes the photo URL through, null included", () => {
    expect(toProduct(row({ imageUrl: "/uploads/products/a.jpg" })).imageUrl).toBe(
      "/uploads/products/a.jpg",
    );
    expect(toProduct(row({ imageUrl: null })).imageUrl).toBeNull();
  });
});

describe("toRootStockStatus / toBackendStockStatus", () => {
  it("round-trips every value", () => {
    expect(toRootStockStatus("IN_STOCK")).toBe("available");
    expect(toRootStockStatus("LOW_STOCK")).toBe("limited");
    expect(toRootStockStatus("OUT_OF_STOCK")).toBe("out_of_stock");
    expect(toBackendStockStatus("available")).toBe("IN_STOCK");
    expect(toBackendStockStatus("limited")).toBe("LOW_STOCK");
    expect(toBackendStockStatus("out_of_stock")).toBe("OUT_OF_STOCK");
  });

  it("fails safe to out_of_stock on an unrecognized backend value", () => {
    expect(toRootStockStatus("SOME_FUTURE_VALUE")).toBe("out_of_stock");
  });
});
