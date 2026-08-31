"use client";

import { create } from "zustand";
import type { AuthenticatedUser } from "@/lib/api/seller-panel/types";

/**
 * Seller-panel session. Deliberately NOT persisted (no zustand `persist`,
 * no localStorage): the access token only ever lives in memory, and the
 * refresh token never reaches the browser's JS at all — the backend sets it
 * as an httpOnly cookie (see backend/src/auth/auth.controller.ts). A hard
 * reload loses the access token on purpose; app/seller/layout.tsx recovers
 * the session by calling POST /auth/refresh on mount, which succeeds as long
 * as the httpOnly cookie is still valid.
 */
interface SellerAuthState {
  accessToken: string | null;
  user: AuthenticatedUser | null;
  status: "idle" | "authenticated" | "unauthenticated";
  setSession: (accessToken: string, user: AuthenticatedUser) => void;
  clear: () => void;
}

export const useSellerAuthStore = create<SellerAuthState>()((set) => ({
  accessToken: null,
  user: null,
  status: "idle",
  setSession: (accessToken, user) => set({ accessToken, user, status: "authenticated" }),
  clear: () => set({ accessToken: null, user: null, status: "unauthenticated" }),
}));
