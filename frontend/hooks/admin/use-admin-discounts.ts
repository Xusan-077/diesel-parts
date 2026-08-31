"use client";

import { useQuery } from "@tanstack/react-query";
import { adminKeys } from "@/lib/api/admin/keys";
import {
  decideDiscount,
  fetchPendingDiscounts,
  type DiscountListRow,
} from "@/lib/api/admin/resources";
import { PANEL_STALE_MS, usePanelMutation } from "./use-panel-mutation";

/**
 * Discount requests still waiting on a decision.
 *
 * No paging: the queue is what a director has to answer today, and one long
 * enough to page through would mean the panel had stopped being used.
 */
export function useAdminDiscounts(initialData?: DiscountListRow[]) {
  return useQuery({
    queryKey: adminKeys.discounts.list(),
    queryFn: fetchPendingDiscounts,
    initialData,
    staleTime: PANEL_STALE_MS,
  });
}

/**
 * Approving or refusing one request.
 *
 * A decided request leaves the queue, so the invalidation is what removes the
 * card — there is nothing to update in place. Orders are invalidated with it:
 * an approved percentage is applied to the order total immediately, and a
 * seller with that order open should not be reading the old figure.
 */
export function useDecideDiscount() {
  return usePanelMutation<{ id: string; approve: boolean; note: string | null }, void>({
    run: ({ id, approve, note }) => decideDiscount(id, { approve, note }),
    invalidates: [adminKeys.discounts.all, adminKeys.customers.all, adminKeys.audit.all],
    success: ({ approve }) => (approve ? "Chegirma tasdiqlandi" : "Chegirma rad etildi"),
    // No failure toast: the card keeps the message under its own buttons, which
    // is where the director is looking after pressing one.
  });
}
