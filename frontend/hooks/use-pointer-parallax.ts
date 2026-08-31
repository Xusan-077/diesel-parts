"use client";

import { useEffect, useRef } from "react";

/**
 * Drifts an element's decoration with the pointer, without re-rendering.
 *
 * Two screens paint their own ground and want the artwork behind them to lean
 * as the pointer moves: the storefront's 404 and the panel's front door. This
 * is the whole mechanism they share — one `pointermove` listener, folded into
 * an animation frame, writing `--parallax-x` and `--parallax-y` on one
 * element. The layers that should drift read those two properties in CSS, so
 * no React state changes and nothing re-renders while the pointer moves.
 *
 * The listener is on `window` rather than the element: both callers are
 * backdrops behind content, and a pointer crossing the text above them must
 * still move the artwork.
 *
 * Nothing is attached at all under `prefers-reduced-motion: reduce`. The
 * properties stay at whatever the stylesheet declared, which is why both
 * scenes declare them — a backdrop must be correct before a pointer has ever
 * moved, and for some readers it never will.
 *
 * @param range How far, in pixels, the pointer can push the properties from
 *   centre. Each layer scales that further in CSS.
 */
export function usePointerParallax<T extends HTMLElement>(range: number) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let frame = 0;

    function onPointerMove(event: PointerEvent) {
      if (frame) {
        return;
      }
      // Coalesced into one frame: a pointer can fire far more often than the
      // screen refreshes, and every extra write is a layout the page pays for.
      frame = requestAnimationFrame(() => {
        frame = 0;
        const offsetX = event.clientX / window.innerWidth - 0.5;
        const offsetY = event.clientY / window.innerHeight - 0.5;
        element?.style.setProperty("--parallax-x", `${(offsetX * range * 2).toFixed(1)}px`);
        element?.style.setProperty("--parallax-y", `${(offsetY * range * 2).toFixed(1)}px`);
      });
    }

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      if (frame) {
        cancelAnimationFrame(frame);
      }
    };
  }, [range]);

  return ref;
}
