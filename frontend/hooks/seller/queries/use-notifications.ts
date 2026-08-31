"use client";

import { useQuery } from "@tanstack/react-query";
import { sellerKeys } from "../keys";
import { fetchNotifications } from "@/lib/api/seller-panel/notifications";
import { useSellerAuthStore } from "@/lib/store/seller-auth-store";

export function useNotifications() {
  const status = useSellerAuthStore((s) => s.status);
  return useQuery({
    queryKey: sellerKeys.notifications.list(),
    queryFn: fetchNotifications,
    enabled: status === "authenticated",
    refetchInterval: 60_000,
  });
}
