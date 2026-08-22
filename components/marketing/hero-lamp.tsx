"use client";

import { useEffect, useRef } from "react";

/**
 * The measurement grid, and the module the cursor is over.
 *
 * Adapted from the mouse-follow grid hero published on 21st.dev
 * (`uniquesonu/modern-hero-section-1`), which paired the grid with a radial
 * glow tracking the cursor. The glow is not here: on a flat white page a soft
 * orange pool has no depth to belong to and reads as a smudge over the
 * headline. The tile is the part worth keeping — it snaps to the grid module,
 * so it reads as picking one part off a technical drawing, and every edge of
 * it is hard.
 *
 * The whole effect is three CSS custom properties. Nothing re-renders on move:
 * the handler writes `--tile-x` / `--tile-y` straight to the node, throttled to
 * one write per frame, and the compositor does the rest.
 */
export function HeroLamp() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // A cursor is required for cursor-following. On touch the grid stays as a
    // quiet backdrop rather than chasing the last tap.
    const finePointer = window.matchMedia("(pointer: fine)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!finePointer.matches || reduced.matches) return;

    let frame = 0;
    let pending: { x: number; y: number } | null = null;

    function flush() {
      frame = 0;
      const node = ref.current;
      if (!node || !pending) return;

      const rect = node.getBoundingClientRect();
      const x = pending.x - rect.left;
      const y = pending.y - rect.top;

      // The module size is owned by the stylesheet; read it rather than
      // duplicating the number here.
      const gridStep =
        Number.parseFloat(getComputedStyle(node).getPropertyValue("--lamp-module")) || 64;

      node.style.setProperty("--tile-x", `${Math.floor(x / gridStep) * gridStep}px`);
      node.style.setProperty("--tile-y", `${Math.floor(y / gridStep) * gridStep}px`);
      node.style.setProperty("--tile-on", "1");
    }

    function onMove(event: PointerEvent) {
      pending = { x: event.clientX, y: event.clientY };
      if (!frame) frame = requestAnimationFrame(flush);
    }

    function onLeave() {
      const node = ref.current;
      if (!node) return;
      node.style.setProperty("--tile-on", "0");
    }

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return <div ref={ref} aria-hidden className="hero-lamp" />;
}
