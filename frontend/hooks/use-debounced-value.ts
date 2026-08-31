"use client";

import { useEffect, useState } from "react";

/**
 * Delays propagating a fast-changing value, so typing in the catalog search
 * does not fire a request per keystroke.
 */
export function useDebouncedValue<T>(value: T, delayMs: number = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
