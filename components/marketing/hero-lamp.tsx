"use client";

import { useEffect, useRef } from "react";

/**
 * The inspection lamp.
 *
 * Adapted from the mouse-follow grid hero published on 21st.dev
 * (`uniquesonu/modern-hero-section-1`): a measurement grid, a radial glow that
 * tracks the cursor, and a highlighted tile beneath it. Re-cut for this site —
 * the glow is the brand orange rather than a SaaS violet, and the tile snaps to
 * the grid module so it reads as picking a part off a technical drawing.
 *
 * The whole effect is two CSS custom properties. Nothing re-renders on move:
 * the handler writes `--lamp-x` / `--lamp-y` straight to the node, throttled to
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

      node.style.setProperty("--lamp-x", `${x}px`);
      node.style.setProperty("--lamp-y", `${y}px`);
      node.style.setProperty("--tile-x", `${Math.floor(x / gridStep) * gridStep}px`);
      node.style.setProperty("--tile-y", `${Math.floor(y / gridStep) * gridStep}px`);
      node.style.setProperty("--lamp-on", "1");
      node.style.setProperty("--tile-on", "1");
    }

    function onMove(event: PointerEvent) {
      pending = { x: event.clientX, y: event.clientY };
      if (!frame) frame = requestAnimationFrame(flush);
    }

    function onLeave() {
      const node = ref.current;
      if (!node) return;
      node.style.setProperty("--lamp-on", "0");
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
