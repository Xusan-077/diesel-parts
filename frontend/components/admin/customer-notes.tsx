"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUpdateCustomer } from "@/hooks/admin/use-admin-customers";
import { toast } from "sonner";
import { requestErrorMessage } from "@/lib/api/request-error";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export interface CustomerNotesProps {
  customerId: string;
  notes: string | null;
  /** False for a pooled account: readable by any seller, writable by none. */
  editable: boolean;
}

/**
 * The seller's running note on the account.
 *
 * One field rather than an append-only log, which is what `Customer.notes`
 * stores. What the account has actually done over time is the timeline below
 * this; this is the standing summary a seller wants before they dial.
 */
export function CustomerNotes({ customerId, notes, editable }: CustomerNotesProps) {
  const router = useRouter();
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const update = useUpdateCustomer();
  const busy = update.isPending;

  /*
   * Falling back to the saved note rather than seeding state from it means a
   * refresh that brings a colleague's newer note simply shows it, while a
   * half-written draft still wins over whatever arrives underneath.
   */
  const value = draft ?? notes ?? "";
  const dirty = draft !== null && draft !== (notes ?? "");

  if (!editable) {
    return notes === null ? null : (
      <p className="whitespace-pre-wrap text-sm text-muted">{notes}</p>
    );
  }

  async function save() {
    setError(null);

    try {
      await update.mutateAsync({ id: customerId, values: { notes: value.trim() || null } });

      setDraft(null);
      toast.success("Izoh saqlandi");
  /*
   * The invalidation inside the mutation refreshes the customer *lists*. This
   * screen is not one of them: the account it draws is read by a server
   * component, so `router.refresh()` is what re-reads it. Both are needed, and
   * they are not duplicates — one re-runs this route, the other drops caches
   * the route knows nothing about.
   */
      router.refresh();
    } catch (cause) {
      const message = requestErrorMessage(cause, "Saqlanmadi.");
      setError(message);
      toast.error(message);
    }
  }

  return (
    <div>
      <Textarea
        aria-label="Mijoz haqida izoh"
        rows={4}
        value={value}
        disabled={busy}
        className="min-h-0 text-sm"
        placeholder="Nima bilan shug'ullanadi, qanday to'laydi, kim bilan gaplashiladi"
        onChange={(event) => setDraft(event.target.value)}
      />

      <div aria-live="polite" className="min-h-5">
        {error === null ? null : (
          <p role="alert" className="mt-2 text-sm text-danger">
            {error}
          </p>
        )}
      </div>

      <Button
        type="button"
        size="sm"
        variant="outline"
        className="mt-2"
        disabled={busy || !dirty}
        onClick={save}
      >
        {busy ? "Saqlanmoqda…" : "Izohni saqlash"}
      </Button>
    </div>
  );
}
