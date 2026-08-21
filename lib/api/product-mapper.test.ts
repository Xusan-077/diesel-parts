import { describe, expect, it } from "vitest";
import { Prisma } from "@/prisma/generated/prisma/client";
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
    price: new Prisma.Decimal("3450000.00"),
    currency: "UZS",
    stock: 25,
    minStock: 5,
    stockStatus: "available",
    categoryId: "injector",
    brandId: "cat",
    compatibleModels: ["CAT 320D"],
    specs: [{ label: { uz: "a", ru: "b", en: "c" }, value: "Steel" }],
    imageLabels: ["Front"],
    isActive: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  } as ProductRow;
}

describe("toProduct", () => {
  it("converts Decimal to a plain number so the value survives serialisation", () => {
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

  it("passes the persisted stock status through", () => {
    expect(toProduct(row({ stockStatus: "limited" })).stockStatus).toBe("limited");
  });

  it("never leaks stock or minStock into the public shape", () => {
    const product = toProduct(row());
    expect(product).not.toHaveProperty("stock");
    expect(product).not.toHaveProperty("minStock");
  });

  it("does not leak the raw name columns", () => {
    const product = toProduct(row());
    expect(product).not.toHaveProperty("nameUz");
  });
});
