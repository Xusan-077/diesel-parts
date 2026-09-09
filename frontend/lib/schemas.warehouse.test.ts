import { describe, expect, it } from "vitest";
import {
  goodsReceiptWriteSchema,
  warehouseProductListQuerySchema,
  warehouseWriteSchema,
} from "./schemas";

describe("warehouseProductListQuerySchema", () => {
  it("defaults a bare query to page 1 with an empty term", () => {
    expect(warehouseProductListQuerySchema.parse({})).toEqual({ q: "", page: 1 });
  });

  it("coerces the page from a string and rejects an unknown status", () => {
    expect(warehouseProductListQuerySchema.parse({ page: "3" }).page).toBe(3);
    expect(warehouseProductListQuerySchema.safeParse({ status: "gone" }).success).toBe(false);
  });
});

describe("warehouseWriteSchema", () => {
  it("accepts a name-only warehouse and defaults the status", () => {
    expect(warehouseWriteSchema.parse({ name: "Markaziy" })).toEqual({
      name: "Markaziy",
      status: "ACTIVE",
    });
  });

  it("rejects a code with spaces or punctuation", () => {
    expect(warehouseWriteSchema.safeParse({ name: "X", code: "MY WH" }).success).toBe(false);
    expect(warehouseWriteSchema.safeParse({ name: "X", code: "W-2" }).success).toBe(true);
  });

  it("requires a name", () => {
    const result = warehouseWriteSchema.safeParse({ name: "  " });
    expect(result.success).toBe(false);
  });
});

describe("goodsReceiptWriteSchema", () => {
  const line = { productId: "p-1", quantity: 5, unitCost: 100_000 };

  it("accepts a minimal one-line receipt with defaulted discount and tax", () => {
    const parsed = goodsReceiptWriteSchema.parse({ warehouseId: "w-1", items: [line] });
    expect(parsed).toMatchObject({ warehouseId: "w-1", discount: 0, tax: 0, items: [line] });
  });

  it("requires at least one line", () => {
    expect(goodsReceiptWriteSchema.safeParse({ warehouseId: "w-1", items: [] }).success).toBe(false);
  });

  it("rejects a fractional quantity and a >2dp unit cost", () => {
    expect(
      goodsReceiptWriteSchema.safeParse({ warehouseId: "w-1", items: [{ ...line, quantity: 1.5 }] })
        .success,
    ).toBe(false);
    expect(
      goodsReceiptWriteSchema.safeParse({ warehouseId: "w-1", items: [{ ...line, unitCost: 1.005 }] })
        .success,
    ).toBe(false);
  });

  it("coerces string inputs from the form", () => {
    const parsed = goodsReceiptWriteSchema.parse({
      warehouseId: "w-1",
      discount: "50000",
      items: [{ productId: "p-1", quantity: "3", unitCost: "125000" }],
    });
    expect(parsed.discount).toBe(50_000);
    expect(parsed.items[0]).toEqual({ productId: "p-1", quantity: 3, unitCost: 125_000 });
  });
});
