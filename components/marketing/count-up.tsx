"use client";

import { useEffect, useMemo, useState } from "react";
import { useInView } from "@/hooks/use-in-view";
import {
  COUNT_UP_MS,
  groupWith,
  splitLeadingNumber,
  valueAt,
} from "@/lib/count-up";

/**
 * A headline figure that counts up the first time it is scrolled to.
 *
 * The figure is found in the sentence rather than passed as a number, because
 * that is how the copy is written and how a translator wants to edit it —
 * "10,000+ mahsulot" is one string, not a number and a suffix. A label with no
 * figure in it ("OEM sifat") renders as itself and never mounts a timer, which
 * is most of them.
 *
 * The animation is the *only* thing that changes here. The text a screen reader
 * announces and the text in the server HTML are both the finished figure:
 * `aria-label` carries the real label, the counting digits are `aria-hidden`,
 * and the run only starts after an effect. Someone with JavaScript off, or with
 * reduced motion, reads the number — which is the point of the number.
 */
export function CountUp({
  label,
  className,
}: {
  /** The whole line, e.g. "10,000+ mahsulot". */
  label: string;
  className?: string;
}) {
  // Memoised because it is an effect dependency: a fresh object every render
  // would restart the run on every frame it caused.
  const parsed = useMemo(() => splitLeadingNumber(label), [label]);
  const [ref, inView] = useInView<HTMLSpanElement>();
  const [value, setValue] = useState<number | null>(null);

  useEffect(() => {
    if (parsed === null || !inView) {
      return;
    }

    const target = parsed.value;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let frame = 0;
    // `null` rather than `0`: a timestamp of zero is a real first frame, and a
    // zero sentinel silently restarts the clock on it.
    let started: number | null = null;

    function tick(now: number) {
      started ??= now;
      const elapsed = now - started;
      // Not a degraded path for reduced motion: the figure is the content, and
      // a visitor who asked for less movement still gets the number.
      setValue(reduced ? target : valueAt(elapsed, target));

      if (!reduced && elapsed < COUNT_UP_MS) {
        frame = requestAnimationFrame(tick);
      }
    }

    // The first write happens in a frame callback rather than in the effect
    // body, which is both correct — the run starts when the browser is ready to
    // paint — and what keeps this out of a cascading render.
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, parsed]);

  if (parsed === null) {
    return <span className={className}>{label}</span>;
  }

  // `null` until the run starts, which is every render the server does and the
  // first the client does — so the HTML always contains the finished figure.
  const shown = value === null ? parsed.text : groupWith(value, parsed.separator);

  return (
    <span ref={ref} className={className} aria-label={label}>
      <span aria-hidden className="tabular-nums">
        {shown}
      </span>
      <span aria-hidden>{parsed.rest}</span>
    </span>
  );
}
