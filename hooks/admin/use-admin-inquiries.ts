"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminKeys } from "@/lib/api/admin/keys";
import { fetchInquiryBoard } from "@/lib/api/admin/resources";
import type { InquiryBoardView } from "@/lib/api/inquiry-board-view";
import { PANEL_STALE_MS } from "./use-panel-mutation";

/**
 * How often the board re-reads itself while it is on screen.
 *
 * Nothing here needs to be live to the second — a lead that arrived thirty
 * seconds ago is not more claimable than one that arrived a minute ago — so the
 * board leans on the two moments that actually matter: the seller coming back
 * to the tab, and a slow tick behind that as a backstop.
 */
const POLL_MS = 90_000;

/**
 * The seller's board.
 *
 * This is where the hand-rolled polling went. The component used to register a
 * `focus` listener, a `visibilitychange` listener and a `setInterval`, each
 * calling `router.refresh()`; all three are options on this query now.
 * `refetchIntervalInBackground` is left at its default of false, which is the
 * behaviour that mattered most — a phone in a pocket must not hold a request
 * loop open — and `refetchOnWindowFocus` is turned back on here specifically,
 * against the panel-wide default, because a seller returning to this tab is
 * exactly when a colleague may have taken a lead.
 */
export function useInquiryBoard(initialData?: InquiryBoardView) {
  return useQuery({
    queryKey: adminKeys.inquiries.board(),
    queryFn: fetchInquiryBoard,
    initialData,
    staleTime: PANEL_STALE_MS,
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
  });
}

/**
 * Rereads the board on demand.
 *
 * The board's writes are optimistic and hand-rolled — a card moves under the
 * pointer and rolls back if the server refuses — so they are not
 * `usePanelMutation`s, and this is the invalidation they call instead. A
 * refusal rereads too: the board's picture of that card is then known to be
 * stale, which is how a lead a colleague claimed first snaps to the truth.
 */
export function useInquiryBoardRefresh() {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: adminKeys.inquiries.all });
    // A claim can put a caller in the customer book, and moving a lead to
    // "won" changes what the customer screens count.
    void queryClient.invalidateQueries({ queryKey: adminKeys.customers.all });
  };
}
