"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useCreateExpense, useUpdateExpense } from "@/hooks/admin/use-finance";
import { requestErrorMessage } from "@/lib/api/request-error";
import { useFieldErrors } from "@/lib/forms/use-field-errors";
import { expenseWriteSchema, type ExpenseCategoryValue } from "@/lib/schemas";
import { todayIsoDay } from "@/lib/finance/format";
import { EXPENSE_CATEGORY_OPTIONS } from "@/lib/finance/labels";
import type { ExpenseRow } from "@/lib/api/finance-repository";
import { FormField } from "@/components/ui/form-field";
import { FormModal } from "@/components/ui/form-modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/shadcn/select";

/**
 * Record an expense, or edit one. `useFieldErrors` + the shared
 * `expenseWriteSchema` validates on blur, same as every other panel form.
 */
export function ExpenseFormModal({
  open,
  onOpenChange,
  expense,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Absent for a create. */
  expense?: ExpenseRow;
  onDone: () => void;
}) {
  const editing = expense !== undefined;

  const [form, setForm] = useState({
    title: expense?.title ?? "",
    category: (expense?.category as ExpenseCategoryValue | undefined) ?? "OTHER",
    amount: expense ? String(expense.amount) : "",
    spentAt: expense?.spentAt ? expense.spentAt.slice(0, 10) : todayIsoDay(),
    note: expense?.note ?? "",
  });
  const [error, setError] = useState<string | null>(null);

  const create = useCreateExpense();
  const update = useUpdateExpense();
  const busy = create.isPending || update.isPending;

  const payload = {
    title: form.title.trim(),
    category: form.category,
    amount: form.amount,
    spentAt: form.spentAt,
    note: form.note.trim() || undefined,
  };

  const field = useFieldErrors(expenseWriteSchema, payload);

  const set =
    (key: keyof typeof form) =>
    (value: string) =>
      setForm((current) => ({ ...current, [key]: value }));

  async function submit() {
    if (!field.touchAll() || field.parsed === null) {
      return;
    }
    setError(null);

    try {
      if (editing) {
        await update.mutateAsync({ id: expense.id, values: field.parsed });
        toast.success("Xarajat yangilandi");
      } else {
        await create.mutateAsync(field.parsed);
        toast.success("Xarajat qo'shildi");
      }
      onDone();
    } catch (cause) {
      setError(requestErrorMessage(cause, "Saqlanmadi. Maydonlarni tekshiring."));
    }
  }

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title={editing ? "Xarajatni tahrirlash" : "Yangi xarajat"}
      submitLabel={editing ? "O'zgarishlarni saqlash" : "Xarajat qo'shish"}
      onSubmit={submit}
      busy={busy}
      error={error}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Nomi" required error={field.errorFor("title")} className="sm:col-span-2">
          <Input
            value={form.title}
            onChange={(event) => set("title")(event.target.value)}
            onBlur={() => field.touch("title")}
            placeholder="Sentyabr ijara"
          />
        </FormField>

        <FormField label="Turkum" required error={field.errorFor("category")}>
          <Select value={form.category} onValueChange={(value) => set("category")(value)}>
            <SelectTrigger aria-label="Turkum">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXPENSE_CATEGORY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField label="Summa (so'm)" required error={field.errorFor("amount")}>
          <Input
            value={form.amount}
            inputMode="decimal"
            onChange={(event) => set("amount")(event.target.value)}
            onBlur={() => field.touch("amount")}
            className="font-mono"
            placeholder="4000000"
          />
        </FormField>

        <FormField label="Sana" required error={field.errorFor("spentAt")}>
          <Input
            type="date"
            value={form.spentAt}
            onChange={(event) => set("spentAt")(event.target.value)}
            onBlur={() => field.touch("spentAt")}
          />
        </FormField>

        <FormField label="Izoh" error={field.errorFor("note")} className="sm:col-span-2">
          <Textarea
            value={form.note}
            onChange={(event) => set("note")(event.target.value)}
            onBlur={() => field.touch("note")}
            rows={2}
            placeholder="Ixtiyoriy"
          />
        </FormField>
      </div>
    </FormModal>
  );
}
