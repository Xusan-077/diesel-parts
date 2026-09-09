"use client";

import { useEffect, useState } from "react";
import { COUNT_UP_MS, valueAt } from "@/lib/count-up";
import { formatInteger, formatSum } from "@/lib/analytics/format";

/**
 * The formatters this ticker knows, keyed by a serializable name.
 *
 * The name is passed rather than the function itself: every caller is a Server
 * Component, and a function prop cannot cross the server/client boundary — React
 * throws "Functions cannot be passed directly to Client Components" at render
 * time (it type-checks, so this only ever surfaced as a production 500). The
 * formatters are pure and dependency-free, so the client bundle carries them.
 */
const FORMATTERS = {
  plain: (value: number) => String(Math.round(value)),
  integer: formatInteger,
  sum: formatSum,
} as const;

export type NumberTickerFormat = keyof typeof FORMATTERS;

/**
 * A figure that counts up from zero the first time it mounts.
 *
 * The marketing `CountUp` finds its number inside a sentence; a KPI tile hands
 * over a real `number` and the name of a formatter, so this is the version for
 * the panel. The animation is the only thing that moves: the server HTML and
 * the string a screen reader is given are both the finished, formatted figure —
 * the ticking digits are `aria-hidden`, and `prefers-reduced-motion` skips
 * straight to the end. Above the fold on the dashboard, so it runs on mount
 * rather than on scroll.
 */
export function NumberTicker({
  value,
  format = "plain",
  className,
}: {
  value: number;
  format?: NumberTickerFormat;
  className?: string;
}) {
  const formatValue = FORMATTERS[format];
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
        {formatValue(shown ?? value)}
      </span>
      <span className="sr-only">{formatValue(value)}</span>
    </span>
  );
}
