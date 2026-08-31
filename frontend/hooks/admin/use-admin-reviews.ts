"use client";

import { useQuery } from "@tanstack/react-query";
import { adminKeys } from "@/lib/api/admin/keys";
import {
  deleteReview,
  fetchAdminReviews,
  setReviewApproval,
  type AdminReviewPage,
} from "@/lib/api/admin/resources";
import { PANEL_STALE_MS, usePanelMutation } from "./use-panel-mutation";

/**
 * The moderation queue: every review, visible and hidden together.
 *
 * Seeded from the page's server render and keyed by page number, so the
 * `?page=` links keep working and each page is its own cache entry.
 */
export function useAdminReviews(page: number, initialData?: AdminReviewPage) {
  return useQuery({
    queryKey: adminKeys.reviews.list(page),
    queryFn: () => fetchAdminReviews(page),
    initialData,
    staleTime: PANEL_STALE_MS,
  });
}

/**
 * Taking a review off the site, or putting it back.
 *
 * Reversible, one press, no dialog — so the toast is the whole confirmation,
 * and it names which direction the row just moved.
 */
export function useSetReviewApproval() {
  return usePanelMutation<{ id: string; isApproved: boolean }, void>({
    run: ({ id, isApproved }) => setReviewApproval(id, isApproved),
    invalidates: [adminKeys.reviews.all, adminKeys.audit.all],
    success: ({ isApproved }) => (isApproved ? "Sharh qaytarildi" : "Sharh yashirildi"),
    failure: "Holatni o'zgartirib bo'lmadi.",
  });
}

export function useDeleteReview(onDone?: () => void) {
  return usePanelMutation<string, void>({
    run: deleteReview,
    invalidates: [adminKeys.reviews.all, adminKeys.audit.all],
    success: "Sharh o'chirildi",
    // No failure toast: the confirm dialog stays open and prints the message
    // itself, where a toast would appear behind the dialog that asked.
    onDone,
  });
}
