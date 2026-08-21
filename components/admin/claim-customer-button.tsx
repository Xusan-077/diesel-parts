"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import { isRefusal, requestErrorMessage } from "@/lib/api/request-error";
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
      await axios.post(`/api/v1/customers/${customerId}/claim`);
      toast.success("Mijoz sizga biriktirildi");
      router.refresh();
    } catch (error) {
      const message = requestErrorMessage(error, "Biriktirilmadi.");
      setError(message);
      toast.error(message);

      // Refreshes after a refusal too: it means this page's picture of the
      // account is now known to be out of date. A request that never landed
      // changed nothing, so it leaves the page alone.
      if (isRefusal(error)) {
        router.refresh();
      }
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
