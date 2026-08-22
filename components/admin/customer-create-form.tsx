"use client";

import { useState } from "react";
import { useCreateCustomer } from "@/hooks/admin/use-admin-customers";
import { toast } from "sonner";
import { requestErrorMessage } from "@/lib/api/request-error";
import { useFieldErrors } from "@/lib/forms/use-field-errors";
import { customerCreateSchema } from "@/lib/schemas";
import { FormField } from "@/components/ui/form-field";
import { FormModal } from "@/components/ui/form-modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const EMPTY = { name: "", phone: "", email: "", company: "", notes: "" };

export interface CustomerCreateFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefills the form when the seller arrived from a board card. */
  initial?: Partial<typeof EMPTY>;
  /** Fired after the customer is created, before the list refreshes. */
  onDone: () => void;
}

/**
 * Adds a customer to the seller's own book.
 *
 * Name and phone are the only required fields, matching the API, and the phone
 * is not checked for uniqueness anywhere: `Customer.phone` is deliberately
 * non-unique because a company switchboard is shared by several contacts. The
 * list's search covers the number, so a seller who wants to check first can.
 *
 * This form used to hand-roll the panel's field frame in a local `FIELD`
 * constant, and had drifted from the real one — it was a bare rail with no box,
 * and every control inside it had to cancel its own border with
 * `border-0 px-0 focus:border-0`. It goes through `FormField` now, which is
 * where that treatment actually lives.
 */
export function CustomerCreateForm({
  open,
  onOpenChange,
  initial,
  onDone,
}: CustomerCreateFormProps) {
  const [form, setForm] = useState({ ...EMPTY, ...initial });
  const [error, setError] = useState<string | null>(null);

  const create = useCreateCustomer();
  const busy = create.isPending;

  const set = (field: keyof typeof EMPTY) => (value: string) =>
    setForm((current) => ({ ...current, [field]: value }));

  /*
   * Blank optional fields are sent as null, not "": the schema takes a nullable
   * string, and an empty string would be stored as one — a customer whose email
   * is the empty string is not the same record as one with no email on file.
   */
  const payload = {
    name: form.name.trim(),
    phone: form.phone.trim(),
    email: form.email.trim() || null,
    company: form.company.trim() || null,
    notes: form.notes.trim() || null,
  };

  const field = useFieldErrors(customerCreateSchema, payload);

  async function submit() {
    if (!field.touchAll()) {
      return;
    }

    setError(null);

    try {
      // The mutation invalidates the customer lists, which is what refills the
      // table behind this dialog.
      await create.mutateAsync(payload);

      setForm({ ...EMPTY });
      toast.success("Mijoz qo'shildi");
      onDone();
    } catch (cause) {
      const message = requestErrorMessage(cause, "Saqlanmadi. Maydonlarni tekshiring.");
      setError(message);
      toast.error(message);
    }
  }

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="Yangi mijoz qo'shish"
      description="Ism va telefon yetarli — qolganini keyin to'ldirsangiz ham bo'ladi."
      submitLabel="Mijoz qo'shish"
      onSubmit={submit}
      busy={busy}
      error={error}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Ismi" required error={field.errorFor("name")}>
          <Input
            value={form.name}
            onChange={(event) => set("name")(event.target.value)}
            onBlur={() => field.touch("name")}
            placeholder="Anvar Karimov"
          />
        </FormField>

        <FormField label="Telefon" required error={field.errorFor("phone")}>
          <Input
            type="tel"
            value={form.phone}
            onChange={(event) => set("phone")(event.target.value)}
            onBlur={() => field.touch("phone")}
            className="font-mono"
            placeholder="+998 90 000 00 00"
          />
        </FormField>

        <FormField label="Kompaniya" error={field.errorFor("company")}>
          <Input
            value={form.company}
            onChange={(event) => set("company")(event.target.value)}
            onBlur={() => field.touch("company")}
            placeholder="Yo'l Qurilish MChJ"
          />
        </FormField>

        <FormField label="Email" error={field.errorFor("email")}>
          <Input
            type="email"
            autoComplete="off"
            value={form.email}
            onChange={(event) => set("email")(event.target.value)}
            onBlur={() => field.touch("email")}
            className="font-mono"
            placeholder="anvar@yolqurilish.uz"
          />
        </FormField>
      </div>

      <FormField label="Izoh" multiline error={field.errorFor("notes")}>
        <Textarea
          rows={3}
          value={form.notes}
          onChange={(event) => set("notes")(event.target.value)}
          onBlur={() => field.touch("notes")}
          placeholder="Qanday mijoz, nima bilan shug'ullanadi, qaysi texnikasi bor"
        />
      </FormField>
    </FormModal>
  );
}
