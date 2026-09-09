import { describe, expect, it } from "vitest";
import {
  expenseCategorySchema,
  paymentMethodSchema,
  expenseWriteSchema,
  debtPaymentSchema,
} from "@/lib/schemas";
import {
  EXPENSE_CATEGORY_LABEL,
  MANUAL_PAYMENT_METHOD_OPTIONS,
  PAYMENT_METHOD_LABEL,
} from "./labels";

describe("finance labels", () => {
  it("labels every expense category the schema allows", () => {
    for (const value of expenseCategorySchema.options) {
      expect(EXPENSE_CATEGORY_LABEL[value]).toBeTruthy();
    }
  });

  it("labels every payment method the schema allows", () => {
    for (const value of paymentMethodSchema.options) {
      expect(PAYMENT_METHOD_LABEL[value]).toBeTruthy();
    }
  });

  it("offers only hand-recordable methods for a debt payment", () => {
    expect(MANUAL_PAYMENT_METHOD_OPTIONS.map((o) => o.value)).toEqual(["CASH", "CARD", "TRANSFER"]);
  });
});

describe("expenseWriteSchema", () => {
  it("coerces a numeric string amount and rejects a non-positive one", () => {
    const ok = expenseWriteSchema.safeParse({
      title: "Sentyabr ijara",
      category: "RENT",
      amount: "4000000",
      spentAt: "2026-09-01",
    });
    expect(ok.success).toBe(true);
    expect(ok.success && ok.data.amount).toBe(4_000_000);

    expect(expenseWriteSchema.safeParse({
      title: "x",
      category: "RENT",
      amount: "0",
      spentAt: "2026-09-01",
    }).success).toBe(false);
  });

  it("rejects an amount with more than two decimals and a malformed date", () => {
    expect(expenseWriteSchema.safeParse({
      title: "x",
      category: "OTHER",
      amount: "10.005",
      spentAt: "2026-09-01",
    }).success).toBe(false);

    expect(expenseWriteSchema.safeParse({
      title: "x",
      category: "OTHER",
      amount: "10",
      spentAt: "01.09.2026",
    }).success).toBe(false);
  });
});

describe("debtPaymentSchema", () => {
  it("accepts a bare amount + method and defaults paidAt to absent", () => {
    const parsed = debtPaymentSchema.safeParse({ amount: "500000", method: "CASH" });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.paidAt).toBeUndefined();
  });

  it("rejects a method customers use but staff cannot record by hand", () => {
    expect(debtPaymentSchema.safeParse({ amount: "1", method: "ONLINE" }).success).toBe(false);
  });
});
