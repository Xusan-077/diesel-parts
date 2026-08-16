"use client";

import { useCallback, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Keeps tabs in sync; `storage` does not fire in the tab that wrote the value.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

/**
 * Reads a string from localStorage as an external store, so the server render
 * and the hydration pass both see `fallback` and no effect has to patch state.
 */
export function useLocalStorageValue(
  key: string,
  fallback: string
): readonly [string, (next: string) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(key) ?? fallback,
    () => fallback
  );

  const setValue = useCallback(
    (next: string) => {
      window.localStorage.setItem(key, next);
      notify();
    },
    [key]
  );

  return [value, setValue] as const;
}
