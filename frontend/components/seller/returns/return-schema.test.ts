import { describe, expect, it } from "vitest";
import { returnSchema } from "./return-schema";
import { computeReturnableLines } from "./return-lines";
import { dateRangeQuery } from "@/lib/seller/return-dates";
import type { Order, Return } from "@/lib/api/seller-panel/types";
const item = {
  productId: "p1",
  name: "Filter",
  sku: "F1",
  unitPrice: 100,
  remainingQty: 2,
  selected: true,
  qty: 1,
  reason: "OTHER",
  condition: "GOOD",
};
const values = { refundMethod: "CASH", refundAmount: 100, items: [item] };
describe("return validation", () => {
  it("requires selection and rejects excess quantities and amounts", () => {
    expect(returnSchema.safeParse(values).success).toBe(true);
    expect(returnSchema.safeParse({ ...values, items: [] }).success).toBe(
      false,
    );
    expect(
      returnSchema.safeParse({ ...values, items: [{ ...item, qty: 3 }] })
        .success,
    ).toBe(false);
    expect(
      returnSchema.safeParse({ ...values, refundAmount: 101 }).success,
    ).toBe(false);
    expect(
      returnSchema.safeParse({ ...values, refundAmount: Number.NaN }).success,
    ).toBe(false);
  });
  it.each(["PAYME", "CLICK", "PAYNET", "ORIGINAL"])(
    "accepts %s and an adjusted amount",
    (refundMethod) => {
      expect(
        returnSchema.safeParse({ ...values, refundMethod, refundAmount: 80 })
          .success,
      ).toBe(true);
    },
  );
  it("merges repeated sale lines and subtracts previous returns", () => {
    const order = {
      items: [
        {
          productId: "p1",
          qty: 2,
          unitPrice: "100",
          productName: "Filter",
          productSku: "F1",
        },
        {
          productId: "p1",
          qty: 3,
          unitPrice: "100",
          productName: "Filter",
          productSku: "F1",
        },
      ],
    } as Order;
    const previous = [{ items: [{ productId: "p1", qty: 4 }] }] as Return[];
    expect(computeReturnableLines(order, previous)[0]).toMatchObject({
      purchasedQty: 5,
      remainingQty: 1,
      unitPrice: 100,
    });
  });
  it("includes the full end date", () => {
    const query = dateRangeQuery({
      from: new Date(2026, 8, 1),
      to: new Date(2026, 8, 11),
    });
    const end = new Date(query.dateTo!);
    expect(end.getHours()).toBe(23);
    expect(end.getMilliseconds()).toBe(999);
  });
});
