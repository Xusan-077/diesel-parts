"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export interface SavedCustomer {
  id: string;
  name: string;
}

export interface SaveCustomerButtonProps {
  /** What the card knows about the caller. Copied as-is into the new card. */
  customerName: string;
  phone: string;
  email: string | null;
  message: string;
  /** Set when this number is already in the seller's book. */
  saved: SavedCustomer | null;
}

/**
 * Turns a board card into a customer card.
 *
 * Deliberately outside the board's optimistic overlay: that machinery patches
 * fields of an inquiry, and this writes a different row entirely. Keeping its
 * state local means a failure here cannot roll back an unrelated claim that is
 * still in flight on the same card.
 *
 * There is no link stored between the two rows — `Inquiry` has no customer
 * foreign key, because a lead arrives before anyone knows whose account it is —
 * so "already saved" is answered by matching the phone. That is also why this
 * turns into a link rather than disappearing: the seller's next question after
 * "is it saved?" is "show me".
 */
export function SaveCustomerButton({
  customerName,
  phone,
  email,
  message,
  saved,
}: SaveCustomerButtonProps) {
  const router = useRouter();
  const [created, setCreated] = useState<SavedCustomer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const existing = created ?? saved;

  if (existing !== null) {
    return (
      <Link
        href={`/admin/seller/customers/${existing.id}`}
        className="text-xs text-muted underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
      >
        Mijoz kartasi: {existing.name}
      </Link>
    );
  }

  async function save() {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: customerName,
          phone,
          email,
          // The first thing the customer said is the most useful opening note,
          // and it is about to stop being visible from the customer screen.
          notes: `So'rovdan: ${message}`.slice(0, 2000),
        }),
      });

      const data = (await response.json()) as {
        success: boolean;
        id?: string;
        errors?: Record<string, string[] | undefined>;
      };

      if (!data.success || data.id === undefined) {
        setError(data.errors?._root?.[0] ?? "Saqlanmadi.");
        return;
      }

      setCreated({ id: data.id, name: customerName });
      router.refresh();
    } catch {
      setError("Ulanmadi. Qayta urinib ko'ring.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={save}>
        {busy ? "Saqlanmoqda…" : "Mijozlarga qo'shish"}
      </Button>

      <div aria-live="polite">
        {error === null ? null : (
          <p role="alert" className="mt-2 text-xs text-danger">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
