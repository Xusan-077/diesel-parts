"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRecordDebtPayment } from "@/hooks/admin/use-finance";
import { requestErrorMessage } from "@/lib/api/request-error";
import { useFieldErrors } from "@/lib/forms/use-field-errors";
import { debtPaymentSchema } from "@/lib/schemas";
import { formatSum } from "@/lib/analytics/format";
import { todayIsoDay } from "@/lib/finance/format";
import { MANUAL_PAYMENT_METHOD_OPTIONS } from "@/lib/finance/labels";
import type { DebtRow } from "@/lib/api/finance-repository";
import { FormField } from "@/components/ui/form-field";
import { FormModal } from "@/components/ui/form-modal";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/shadcn/select";

/**
 * Record a partial (or clearing) payment against one debtor's order. The
 * amount cannot exceed the outstanding balance — checked here for a quick
 * answer and again by `backend/` (`payment_exceeds_debt`).
 */
export function DebtPaymentModal({
  open,
  onOpenChange,
  debt,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debt: DebtRow;
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    amount: String(debt.remaining),
    method: "CASH",
    paidAt: todayIsoDay(),
  });
  const [error, setError] = useState<string | null>(null);

  const record = useRecordDebtPayment(onDone);

  const payload = { amount: form.amount, method: form.method, paidAt: form.paidAt };
  const field = useFieldErrors(debtPaymentSchema, payload);

  const set =
    (key: keyof typeof form) =>
    (value: string) =>
      setForm((current) => ({ ...current, [key]: value }));

  async function submit() {
    if (!field.touchAll() || field.parsed === null) {
      return;
    }
    if (field.parsed.amount > debt.remaining) {
      setError(`Summa qoldiqdan (${formatSum(debt.remaining)}) oshib ketdi.`);
      return;
    }
    setError(null);

    try {
      await record.mutateAsync({ orderId: debt.orderId, values: field.parsed });
      toast.success("To'lov qayd etildi");
      onDone();
    } catch (cause) {
      setError(requestErrorMessage(cause, "Saqlanmadi. Maydonlarni tekshiring."));
    }
  }

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title="To'lov qayd etish"
      description={`${debt.orderNumber} · ${debt.customerName} · qoldiq ${formatSum(debt.remaining)}`}
      submitLabel="Qayd etish"
      onSubmit={submit}
      busy={record.isPending}
      error={error}
    >
      <div className="grid gap-4">
        <FormField label="Summa (so'm)" required error={field.errorFor("amount")}>
          <Input
            value={form.amount}
            inputMode="decimal"
            onChange={(event) => set("amount")(event.target.value)}
            onBlur={() => field.touch("amount")}
            className="font-mono"
            placeholder="1000000"
          />
        </FormField>

        <FormField label="To'lov turi" required error={field.errorFor("method")}>
          <Select value={form.method} onValueChange={(value) => set("method")(value)}>
            <SelectTrigger aria-label="To'lov turi">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MANUAL_PAYMENT_METHOD_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField label="Sana" error={field.errorFor("paidAt")}>
          <Input
            type="date"
            value={form.paidAt}
            onChange={(event) => set("paidAt")(event.target.value)}
            onBlur={() => field.touch("paidAt")}
          />
        </FormField>
      </div>
    </FormModal>
  );
}
