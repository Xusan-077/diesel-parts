"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSellerAuthStore } from "@/lib/store/seller-auth-store";
import { refresh } from "@/lib/api/seller-panel/auth";

/**
 * Recovers the session on a hard reload. The access token only ever lives in
 * memory (see lib/store/seller-auth-store.ts), so every fresh page load
 * starts with status "idle" and has to ask POST /auth/refresh — which
 * succeeds silently off the httpOnly cookie, or fails and sends the visitor
 * to /login with `next` set to get them back here after signing in.
 */
export function SellerAuthGate({ children }: { children: React.ReactNode }) {
  const status = useSellerAuthStore((s) => s.status);
  const setSession = useSellerAuthStore((s) => s.setSession);
  const clear = useSellerAuthStore((s) => s.clear);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status !== "idle") return;
    let cancelled = false;

    refresh()
      .then((data) => {
        if (!cancelled) setSession(data.accessToken, data.user);
      })
      .catch(() => {
        if (cancelled) return;
        clear();
        router.replace(`/seller/login?next=${encodeURIComponent(pathname)}`);
      });

    return () => {
      cancelled = true;
    };
  }, [status, setSession, clear, router, pathname]);

  if (status === "idle" || status === "unauthenticated") {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
