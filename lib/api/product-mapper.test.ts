import { describe, expect, it } from "vitest";
import { toProduct, type ProductRow } from "./product-mapper";

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
    stockStatus: "available",
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

  it("passes the computed stock status through", () => {
    expect(toProduct(row({ stockStatus: "limited" })).stockStatus).toBe("limited");
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
