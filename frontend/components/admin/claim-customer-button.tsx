"use client";

import { useRouter } from "next/navigation";
import {
  useClaimCustomer,
  useCustomerRefresh,
} from "@/hooks/admin/use-admin-customers";
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
  const refreshCustomers = useCustomerRefresh();
  const claimCustomer = useClaimCustomer(() => {
    /*
     * The invalidation inside the mutation refreshes the customer *lists*. This
     * screen is not one of them: the account it draws is read by a server
     * component, so `router.refresh()` is what re-reads it. Both are needed, and
     * they are not duplicates — one re-runs this route, the other drops caches
     * the route knows nothing about.
     */
    router.refresh();
  });
  const busy = claimCustomer.isPending;
  const error = claimCustomer.isError
    ? requestErrorMessage(claimCustomer.error, "Biriktirilmadi.")
    : null;

  function claim() {
    claimCustomer.mutate(customerId, {
      onError: (cause) => {
        /*
         * A refusal means this page's picture of the account is now known to be
         * out of date — someone else claimed it — so the customer cache is
         * dropped and reread. A request that never landed changed nothing on
         * the server, so it leaves the cache alone.
         */
        if (isRefusal(cause)) {
          refreshCustomers();
          router.refresh();
        }
      },
    });
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
