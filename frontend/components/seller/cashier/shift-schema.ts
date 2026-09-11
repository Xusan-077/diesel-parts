import { z } from "zod";
export const openingSchema = z.object({
  openingBalance: z
    .number({ error: "Summa kiriting" })
    .min(0, "Summa manfiy bo‘lmasin")
    .multipleOf(0.01, "Ko‘pi bilan 2 kasr xona"),
});
export const balanceDifference = (actual: number, expected: number) => {
  const difference = Math.round((actual - expected) * 100) / 100;
  return Object.is(difference, -0) ? 0 : difference;
};
export const closingSchema = (expected: number) =>
  z
    .object({
      closingBalanceActual: z
        .number({ error: "Haqiqiy qoldiqni kiriting" })
        .min(0, "Summa manfiy bo‘lmasin")
        .multipleOf(0.01, "Ko‘pi bilan 2 kasr xona"),
      comment: z.string().trim().max(2000, "Izoh 2000 belgidan oshmasin"),
    })
    .superRefine((values, ctx) => {
      if (
        balanceDifference(values.closingBalanceActual, expected) !== 0 &&
        !values.comment
      )
        ctx.addIssue({
          code: "custom",
          path: ["comment"],
          message: "Farq sababini izohda yozing",
        });
    });
