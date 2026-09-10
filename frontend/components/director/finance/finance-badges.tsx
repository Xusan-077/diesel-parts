import { Badge } from "@/components/ui/shadcn/badge";
import type { DebtStatusValue } from "@/lib/schemas";
import {
  DEBT_STATUS_LABEL,
  EXPENSE_CATEGORY_LABEL,
  PAYMENT_METHOD_LABEL,
} from "@/lib/finance/labels";

/**
 * The finance module's read-only status chips. One file — they share a
 * vocabulary and are never used far apart.
 */

/** How a customer paid. Neutral (`outline`) — a method is not a status. */
export function PaymentMethodBadge({ method }: { method: string }) {
  const label = PAYMENT_METHOD_LABEL[method as keyof typeof PAYMENT_METHOD_LABEL] ?? method;
  return <Badge variant="outline">{label}</Badge>;
}

/** What an expense was for. Neutral (`secondary`). */
export function ExpenseCategoryBadge({ category }: { category: string }) {
  const label =
    EXPENSE_CATEGORY_LABEL[category as keyof typeof EXPENSE_CATEGORY_LABEL] ?? category;
  return <Badge variant="secondary">{label}</Badge>;
}

/**
 * A debt's settlement state: `PAID` is done (green), `PARTIAL` is in progress
 * (amber), `UNPAID` is untouched (red).
 */
const DEBT_CONFIG: Record<
  DebtStatusValue,
  { variant: "success" | "warning" | "destructive" }
> = {
  PAID: { variant: "success" },
  PARTIAL: { variant: "warning" },
  UNPAID: { variant: "destructive" },
};

export function DebtStatusBadge({ status }: { status: DebtStatusValue }) {
  return <Badge variant={DEBT_CONFIG[status].variant}>{DEBT_STATUS_LABEL[status]}</Badge>;
}
