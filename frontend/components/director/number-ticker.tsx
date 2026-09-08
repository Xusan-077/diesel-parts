"use client";

import { useEffect, useState } from "react";
import { COUNT_UP_MS, valueAt } from "@/lib/count-up";

/**
 * A figure that counts up from zero the first time it mounts.
 *
 * The marketing `CountUp` finds its number inside a sentence; a KPI tile hands
 * over a real `number` and a formatter, so this is the version for the panel.
 * The animation is the only thing that moves: the server HTML and the string a
 * screen reader is given are both the finished, formatted figure — the ticking
 * digits are `aria-hidden`, and `prefers-reduced-motion` skips straight to the
 * end. Above the fold on the dashboard, so it runs on mount rather than on
 * scroll.
 */
export function NumberTicker({
  value,
  format = (n) => String(Math.round(n)),
  className,
}: {
  value: number;
  format?: (value: number) => string;
  className?: string;
}) {
  const [shown, setShown] = useState<number | null>(null);
  // The value at mount, frozen. A KPI that refetches to a new number snaps to
  // it rather than counting again — the count is a first-impression flourish,
  // not a live readout of every change.
  const [target] = useState(value);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let frame = 0;
    let started: number | null = null;

    // The first write is in a frame callback rather than the effect body — the
    // run starts when the browser is ready to paint, and this keeps the update
    // out of a cascading render. Reduced motion is handled here too, not as a
    // separate path: the figure is the content, so it still gets set, just at
    // once. Same shape as components/marketing/count-up.tsx.
    function tick(now: number) {
      started ??= now;
      const elapsed = now - started;
      if (reduced || elapsed >= COUNT_UP_MS) {
        setShown(target);
        return;
      }
      setShown(valueAt(elapsed, target));
      frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return (
    <span className={className}>
      <span aria-hidden="true" className="tabular-nums">
        {format(shown ?? value)}
      </span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}
