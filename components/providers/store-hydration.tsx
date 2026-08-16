"use client";

import { useEffect } from "react";
import { rehydrateStores } from "@/lib/store/stores";

/**
 * Loads the persisted cart, wishlist and compare lists after the first paint.
 * Rendering nothing keeps the server HTML and the first client render
 * identical; the stores fill in on the very next tick.
 */
export function StoreHydration() {
  useEffect(() => {
    rehydrateStores();
  }, []);

  return null;
}
