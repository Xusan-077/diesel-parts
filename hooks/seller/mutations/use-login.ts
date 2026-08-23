"use client";

import { useMutation } from "@tanstack/react-query";
import { login as loginRequest } from "@/lib/api/seller-panel/auth";
import { useSellerAuthStore } from "@/lib/store/seller-auth-store";

export function useLogin() {
  const setSession = useSellerAuthStore((s) => s.setSession);

  return useMutation({
    mutationFn: ({ phone, password }: { phone: string; password: string }) =>
      loginRequest(phone, password),
    onSuccess: (data) => {
      setSession(data.accessToken, data.user);
    },
  });
}
