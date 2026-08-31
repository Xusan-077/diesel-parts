"use client";

import { sellerKeys } from "../keys";
import { useSellerMutation } from "../use-seller-mutation";
import { markNotificationRead } from "@/lib/api/seller-panel/notifications";
import type { AppNotification } from "@/lib/api/seller-panel/types";

export function useMarkNotificationRead() {
  return useSellerMutation<{ id: string }, AppNotification>({
    run: ({ id }) => markNotificationRead(id),
    invalidates: [sellerKeys.notifications.all],
  });
}
