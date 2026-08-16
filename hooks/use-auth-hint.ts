"use client";

import { useSyncExternalStore } from "react";
import { AUTH_HINT_COOKIE } from "@/lib/auth/cookie-names";

function subscribe() {
  // Cookies emit no change event; the value is re-read on every render pass,
  // and every login or logout is followed by a navigation that re-renders.
  return () => {};
}

function getSnapshot(): boolean {
  return document.cookie.split("; ").includes(`${AUTH_HINT_COOKIE}=1`);
}

/**
 * Whether a session probably exists, based on the non-secret hint cookie.
 * Never use this to gate data — the server verifies the real session.
 */
export function useAuthHint(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
