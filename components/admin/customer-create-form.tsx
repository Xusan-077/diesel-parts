"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import { requestErrorMessage } from "@/lib/api/request-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** The panel's field frame: a rule that inks when the field takes focus. */
const FIELD = "border-l-2 border-border pl-4 transition-colors focus-within:border-accent-strong";

const EMPTY = { name: "", phone: "", email: "", company: "", notes: "" };

export interface CustomerCreateFormProps {
  /** Prefills the form when the seller arrived from a board card. */
  initial?: Partial<typeof EMPTY>;
  onDone: () => void;
}

/**
 * Adds a customer to the seller's own book.
 *
 * Name and phone are the only required fields, matching the API, and the phone
 * is not checked for uniqueness anywhere: `Customer.phone` is deliberately
 * non-unique because a company switchboard is shared by several contacts. The
 * list's search covers the number, so a seller who wants to check first can.
 */
export function CustomerCreateForm({ initial, onDone }: CustomerCreateFormProps) {
  const router = useRouter();
  const fieldId = useId();
  const [form, setForm] = useState({ ...EMPTY, ...initial });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const id = (field: string) => `${fieldId}-${field}`;
  const set = (field: keyof typeof EMPTY) => (value: string) =>
    setForm((current) => ({ ...current, [field]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      await axios.post("/api/v1/customers", {
        name: form.name.trim(),
        phone: form.phone.trim(),
        // Blank optional fields are sent as null, not "": the schema takes a
        // nullable string, and an empty string would be stored as one.
        email: form.email.trim() || null,
        company: form.company.trim() || null,
        notes: form.notes.trim() || null,
      });

      setForm({ ...EMPTY });
      toast.success("Mijoz qo'shildi");
      onDone();
      router.refresh();
    } catch (error) {
      const message = requestErrorMessage(error, "Saqlanmadi. Maydonlarni tekshiring.");
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 max-w-3xl rounded-lg border border-border p-6" noValidate>
      <h2 className="type-eyebrow text-muted">
        Yangi mijoz
      </h2>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className={FIELD}>
          <Label htmlFor={id("name")}>Ismi</Label>
          <Input
            id={id("name")}
            value={form.name}
            onChange={(event) => set("name")(event.target.value)}
            className="mt-2 border-0 px-0 focus:border-0"
            required
          />
        </div>

        <div className={FIELD}>
          <Label htmlFor={id("phone")}>Telefon</Label>
          <Input
            id={id("phone")}
            type="tel"
            value={form.phone}
            onChange={(event) => set("phone")(event.target.value)}
            className="mt-2 border-0 px-0 font-mono focus:border-0"
            placeholder="+998 90 000 00 00"
            required
          />
        </div>

        <div className={FIELD}>
          <Label htmlFor={id("company")}>Kompaniya</Label>
          <Input
            id={id("company")}
            value={form.company}
            onChange={(event) => set("company")(event.target.value)}
            className="mt-2 border-0 px-0 focus:border-0"
            placeholder="Ixtiyoriy"
          />
        </div>

        <div className={FIELD}>
          <Label htmlFor={id("email")}>Email</Label>
          <Input
            id={id("email")}
            type="email"
            autoComplete="off"
            value={form.email}
            onChange={(event) => set("email")(event.target.value)}
            className="mt-2 border-0 px-0 focus:border-0"
            placeholder="Ixtiyoriy"
          />
        </div>
      </div>

      <div className={`mt-4 ${FIELD}`}>
        <Label htmlFor={id("notes")}>Izoh</Label>
        <Textarea
          id={id("notes")}
          rows={3}
          value={form.notes}
          onChange={(event) => set("notes")(event.target.value)}
          className="mt-2 min-h-0 border-0 px-0 text-sm focus:border-0"
          placeholder="Qanday mijoz, nima bilan shug'ullanadi"
        />
      </div>

      <div aria-live="polite" className="min-h-5">
        {error === null ? null : (
          <p role="alert" className="mt-4 text-sm text-danger">
            {error}
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Qo'shilmoqda…" : "Mijoz qo'shish"}
        </Button>
        <button
          type="button"
          onClick={onDone}
          className="text-xs text-muted transition-colors hover:text-foreground"
        >
          Bekor qilish
        </button>
      </div>
    </form>
  );
}
