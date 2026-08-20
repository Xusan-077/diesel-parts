"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/**
 * Takes an unassigned account into the seller's own book.
 *
 * The same compare-and-set as a board claim, and the same failure worth
 * printing: a colleague may have taken the account between this page rendering
 * and the button being pressed, and the seller has to be told rather than left
 * looking at a screen that quietly did nothing.
 */
export function ClaimCustomerButton({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function claim() {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/customers/${customerId}/claim`, { method: "POST" });
      const data = (await response.json()) as {
        success: boolean;
        errors?: Record<string, string[] | undefined>;
      };

      if (!data.success) {
        setError(data.errors?._root?.[0] ?? "Biriktirilmadi.");
      }

      // Refreshes either way: a refusal means this page's picture of the
      // account is now known to be out of date.
      router.refresh();
    } catch {
      setError("Ulanmadi. Qayta urinib ko'ring.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Button type="button" size="sm" disabled={busy} onClick={claim}>
        {busy ? "Biriktirilmoqda…" : "Men olaman"}
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
