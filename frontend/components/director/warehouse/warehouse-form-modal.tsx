"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useAdminStaff } from "@/hooks/admin/use-admin-staff";
import { useCreateWarehouse, useUpdateWarehouse } from "@/hooks/admin/use-warehouse";
import { requestErrorMessage } from "@/lib/api/request-error";
import { useFieldErrors } from "@/lib/forms/use-field-errors";
import { warehouseWriteSchema } from "@/lib/schemas";
import type { WarehouseRow } from "@/lib/api/warehouse-repository";
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
 * Open a warehouse, or edit one.
 *
 * `useFieldErrors` + the shared `warehouseWriteSchema` (not React Hook Form —
 * the panel's forms standardised on this) validates on blur and clears as the
 * value becomes good. A refusal only the backend can make — a code already in
 * use — comes back and pins itself to the code field.
 */

const NONE = "__none__";

export function WarehouseFormModal({
  open,
  onOpenChange,
  warehouse,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Absent for a create. */
  warehouse?: WarehouseRow;
  onDone: () => void;
}) {
  const editing = warehouse !== undefined;
  const staff = useAdminStaff();

  const [form, setForm] = useState({
    name: warehouse?.name ?? "",
    code: warehouse?.code ?? "",
    address: warehouse?.address ?? "",
    managerId: warehouse?.managerId ?? "",
    status: warehouse?.status ?? "ACTIVE",
  });
  const [error, setError] = useState<string | null>(null);

  const create = useCreateWarehouse();
  const update = useUpdateWarehouse();
  const busy = create.isPending || update.isPending;

  const payload = {
    name: form.name.trim(),
    code: form.code.trim() || undefined,
    address: form.address.trim() || undefined,
    managerId: form.managerId || undefined,
    status: form.status as "ACTIVE" | "INACTIVE",
  };

  const field = useFieldErrors(warehouseWriteSchema, payload);

  const set =
    (key: keyof typeof form) =>
    (value: string) =>
      setForm((current) => ({ ...current, [key]: value }));

  async function submit() {
    if (!field.touchAll()) {
      return;
    }
    setError(null);

    try {
      if (editing) {
        await update.mutateAsync({ id: warehouse.id, values: payload });
        toast.success("Ombor yangilandi");
      } else {
        await create.mutateAsync(payload);
        toast.success("Ombor qo'shildi");
      }
      onDone();
    } catch (cause) {
      const message = requestErrorMessage(cause, "Saqlanmadi. Maydonlarni tekshiring.");
      // A taken code is the one refusal worth pinning to a field.
      if (/kod/i.test(message)) {
        field.setServerErrors({ code: message });
      } else {
        setError(message);
      }
    }
  }

  const activeStaff = (staff.data ?? []).filter((row) => row.isActive);

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title={editing ? "Omborni tahrirlash" : "Yangi ombor"}
      description={
        editing
          ? undefined
          : "Kodni bo'sh qoldirsangiz, tizim keyingi bo'sh W-raqamni beradi."
      }
      submitLabel={editing ? "O'zgarishlarni saqlash" : "Ombor qo'shish"}
      onSubmit={submit}
      busy={busy}
      error={error}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Nomi" required error={field.errorFor("name")}>
          <Input
            value={form.name}
            onChange={(event) => set("name")(event.target.value)}
            onBlur={() => field.touch("name")}
            placeholder="Markaziy ombor"
          />
        </FormField>

        <FormField label="Kod" error={field.errorFor("code")}>
          <Input
            value={form.code}
            onChange={(event) => set("code")(event.target.value)}
            onBlur={() => field.touch("code")}
            className="font-mono"
            placeholder="W1"
          />
        </FormField>

        <FormField label="Manzil" error={field.errorFor("address")} className="sm:col-span-2">
          <Textarea
            value={form.address}
            onChange={(event) => set("address")(event.target.value)}
            onBlur={() => field.touch("address")}
            rows={2}
            placeholder="Toshkent sh., Yunusobod t., Sarikul 12"
          />
        </FormField>

        <FormField label="Menejer" error={field.errorFor("managerId")}>
          <Select
            value={form.managerId || NONE}
            onValueChange={(value) => set("managerId")(value === NONE ? "" : value)}
          >
            <SelectTrigger aria-label="Menejer">
              <SelectValue placeholder="Tanlanmagan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Tanlanmagan</SelectItem>
              {activeStaff.map((row) => (
                <SelectItem key={row.id} value={row.id}>
                  {row.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField label="Holat" error={field.errorFor("status")}>
          <Select value={form.status} onValueChange={(value) => set("status")(value)}>
            <SelectTrigger aria-label="Holat">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ACTIVE">Faol</SelectItem>
              <SelectItem value="INACTIVE">Faol emas</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      </div>
    </FormModal>
  );
}
