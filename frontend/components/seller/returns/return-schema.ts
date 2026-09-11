import { z } from "zod";
export const returnSchema = z
  .object({
    refundMethod: z.enum([
      "CASH",
      "CARD",
      "PAYME",
      "CLICK",
      "PAYNET",
      "ORIGINAL",
    ]),
    refundAmount: z
      .number({ error: "Summa kiriting" })
      .min(0, "Summa manfiy bo‘lmasin")
      .multipleOf(0.01, "Ko‘pi bilan 2 kasr xona"),
    items: z.array(
      z.object({
        productId: z.string(),
        name: z.string(),
        sku: z.string(),
        unitPrice: z.number(),
        remainingQty: z.number(),
        selected: z.boolean(),
        qty: z
          .number({ error: "Miqdor kiriting" })
          .int("Butun son kiriting")
          .min(1, "Kamida 1 dona"),
        reason: z.enum([
          "WRONG_PRODUCT",
          "DEFECTIVE",
          "CHANGED_MIND",
          "DAMAGED",
          "OTHER",
        ]),
        condition: z.enum(["GOOD", "DAMAGED", "USED", "DEFECTIVE"]),
      }),
    ),
  })
  .superRefine((values, ctx) => {
    const selected = values.items.filter((i) => i.selected);
    if (!selected.length)
      ctx.addIssue({
        code: "custom",
        path: ["items", "root"],
        message: "Kamida bitta mahsulot tanlang",
      });
    values.items.forEach((item, i) => {
      if (item.selected && item.qty > item.remainingQty)
        ctx.addIssue({
          code: "custom",
          path: ["items", i, "qty"],
          message: "Maksimal " + item.remainingQty + " dona qaytarish mumkin",
        });
    });
    const total =
      Math.round(
        selected.reduce((sum, i) => sum + i.qty * i.unitPrice, 0) * 100,
      ) / 100;
    if (values.refundAmount > total)
      ctx.addIssue({
        code: "custom",
        path: ["refundAmount"],
        message: "Summa mahsulotlar qiymatidan oshmasin",
      });
  });
export type ReturnFormValues = z.infer<typeof returnSchema>;
