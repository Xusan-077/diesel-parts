"use client";

import { useQuery } from "@tanstack/react-query";
import { me } from "@/lib/api/seller-panel/auth";
import { useSellerAuthStore } from "@/lib/store/seller-auth-store";

export function useMe() {
  const status = useSellerAuthStore((s) => s.status);
  return useQuery({
    queryKey: ["seller", "auth", "me"] as const,
    queryFn: me,
    enabled: status === "authenticated",
  });
}
