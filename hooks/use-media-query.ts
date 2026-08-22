"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Whether a media query currently matches.
 *
 * A subscription rather than an effect that sets state: the browser's match
 * list is external state React does not own, and `useSyncExternalStore` is how
 * you read one without the render-then-correct pass that an effect costs.
 *
 * Answers `false` on the server and through hydration, then settles on the
 * first paint after it. Nothing here may decide *layout* — the showcase
 * branches its grid and its belt in CSS so the server sends the right one —
 * this is only for behaviour with no CSS equivalent, such as whether to run a
 * frame loop or arm a hover animation.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
        return () => {};
      }
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query]
  );

  const read = useCallback(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false;
    }
    return window.matchMedia(query).matches;
  }, [query]);

  // The server has no window, and hydration has to agree with what the server
  // sent — so both start at `false` and the real answer arrives one paint later.
  return useSyncExternalStore(subscribe, read, () => false);
}

/** The site's `lg` breakpoint, where the showcase swaps its belt for a grid. */
export const DESKTOP_QUERY = "(min-width: 1024px)";

/** Set by the visitor's system, and the one preference a frame loop must obey. */
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
