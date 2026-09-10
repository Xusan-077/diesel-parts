import type {
  DebtStatusValue,
  ExpenseCategoryValue,
  PaymentMethodValue,
} from "@/lib/schemas";

/**
 * Uzbek labels for the finance module's enums, in one place so a table cell, a
 * badge and a filter dropdown never disagree about the wording. The panel is
 * Uzbek-only (see `app/admin/layout.tsx`).
 */

export const PAYMENT_METHOD_LABEL: Record<PaymentMethodValue, string> = {
  CASH: "Naqd",
  CARD: "Karta",
  TRANSFER: "O'tkazma",
  ONLINE: "Onlayn",
  SELLER_AGREEMENT: "Kelishuv",
};

export const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategoryValue, string> = {
  RENT: "Ijara",
  SALARY: "Oylik",
  UTILITIES: "Kommunal",
  LOGISTICS: "Logistika",
  TAX: "Soliq",
  SUPPLIES: "Xo'jalik",
  MARKETING: "Marketing",
  BANK: "Bank xizmati",
  OTHER: "Boshqa",
};

export const DEBT_STATUS_LABEL: Record<DebtStatusValue, string> = {
  UNPAID: "To'lanmagan",
  PARTIAL: "Qisman",
  PAID: "To'langan",
};

export const EXPENSE_CATEGORY_OPTIONS = (
  Object.keys(EXPENSE_CATEGORY_LABEL) as ExpenseCategoryValue[]
).map((value) => ({ value, label: EXPENSE_CATEGORY_LABEL[value] }));

export const PAYMENT_METHOD_OPTIONS = (
  Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethodValue[]
).map((value) => ({ value, label: PAYMENT_METHOD_LABEL[value] }));

/** The methods a staff member may pick when recording a debt payment by hand. */
export const MANUAL_PAYMENT_METHOD_OPTIONS: { value: PaymentMethodValue; label: string }[] = [
  { value: "CASH", label: PAYMENT_METHOD_LABEL.CASH },
  { value: "CARD", label: PAYMENT_METHOD_LABEL.CARD },
  { value: "TRANSFER", label: PAYMENT_METHOD_LABEL.TRANSFER },
];
