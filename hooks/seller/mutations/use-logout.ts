"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { logout as logoutRequest } from "@/lib/api/seller-panel/auth";
import { useSellerAuthStore } from "@/lib/store/seller-auth-store";

export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const clear = useSellerAuthStore((s) => s.clear);

  return useMutation({
    mutationFn: logoutRequest,
    onSettled: () => {
      // The server-side revoke can fail (expired token, network) and the
      // local session still has to end — never leave the panel logged in
      // because /auth/logout returned an error.
      clear();
      queryClient.clear();
      router.replace("/login");
    },
  });
}
