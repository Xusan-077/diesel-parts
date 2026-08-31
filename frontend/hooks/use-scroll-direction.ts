"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_SCROLL_THRESHOLDS,
  INITIAL_SCROLL_STATE,
  readScroll,
  type ScrollState,
  type ScrollThresholds,
} from "@/lib/scroll-direction";

/**
 * Tracks how far down the page the visitor is and which way they last moved.
 *
 * The listener is passive and coalesced to one read per animation frame, so a
 * fling produces a single layout read per frame rather than one per event, and
 * `setState` is only called when `readScroll` actually returns a new state —
 * for a full-page scroll that is a handful of re-renders, not sixty a second.
 *
 * The first render always reports the initial state, so the server HTML and
 * the first client render agree; the real position is read in the effect.
 */
export function useScrollDirection(
  thresholds: ScrollThresholds = DEFAULT_SCROLL_THRESHOLDS
): ScrollState {
  const [state, setState] = useState<ScrollState>(INITIAL_SCROLL_STATE);
  const { offset, threshold } = thresholds;

  useEffect(() => {
    // Mirrored outside React so a frame can read the last value without the
    // effect having to depend on `state` and re-subscribe on every change.
    let current = INITIAL_SCROLL_STATE;
    let anchor = Math.max(0, window.scrollY);
    let frame = 0;

    function read() {
      frame = 0;
      const sample = readScroll(current, anchor, window.scrollY, {
        offset,
        threshold,
      });
      anchor = sample.anchor;
      if (sample.state !== current) {
        current = sample.state;
        setState(current);
      }
    }

    function onScroll() {
      if (frame === 0) {
        frame = requestAnimationFrame(read);
      }
    }

    // A reload can restore a position halfway down the page; sync to it once
    // rather than waiting for the visitor to scroll.
    read();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame !== 0) {
        cancelAnimationFrame(frame);
      }
    };
  }, [offset, threshold]);

  return state;
}
