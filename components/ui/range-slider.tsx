"use client";

import { cn } from "@/lib/utils";

export interface RangeSliderProps {
  min: number;
  max: number;
  step?: number;
  /** `[low, high]`, already clamped into `[min, max]` by the caller. */
  value: [number, number];
  onChange: (value: [number, number]) => void;
  /** Accessible names for the two thumbs — they are separate controls. */
  minLabel: string;
  maxLabel: string;
  /** Turns a value into the words a screen reader should say for it. */
  formatValue?: (value: number) => string;
  className?: string;
}

/** Position along the track, as a percentage, safe on a zero-width range. */
function percent(value: number, min: number, max: number): number {
  return max === min ? 0 : ((value - min) / (max - min)) * 100;
}

/**
 * A two-ended range, drawn as one track.
 *
 * The thumbs cannot cross: each one clamps against the other rather than
 * pushing it, so dragging the low end past the high end parks it there instead
 * of dragging both. That is the behaviour a reader expects from a price
 * filter, where the two numbers below the track have to stay readable as "from"
 * and "to" throughout the drag.
 *
 * When both thumbs sit on the same value the high one would swallow every
 * pointer press, leaving the range stuck. The stacking order flips once the
 * pair is in the top half of the track, so whichever thumb the reader is
 * reaching for is the one on top.
 */
export function RangeSlider({
  min,
  max,
  step = 1,
  value,
  onChange,
  minLabel,
  maxLabel,
  formatValue,
  className,
}: RangeSliderProps) {
  const [low, high] = value;
  const lowPercent = percent(low, min, max);
  const highPercent = percent(high, min, max);

  const describe = (current: number) =>
    formatValue === undefined ? undefined : formatValue(current);

  return (
    <div className={cn("relative h-4", className)}>
      {/* The track and its filled span are drawn, not native: the two inputs
          above are transparent so neither can paint over the other's track. */}
      <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-surface-muted" />
      <div
        className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-accent"
        style={{ left: `${lowPercent}%`, right: `${100 - highPercent}%` }}
      />

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={low}
        aria-label={minLabel}
        aria-valuetext={describe(low)}
        onChange={(event) => onChange([Math.min(Number(event.target.value), high), high])}
        className={cn("range-input", lowPercent > 50 ? "z-20" : "z-10")}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={high}
        aria-label={maxLabel}
        aria-valuetext={describe(high)}
        onChange={(event) => onChange([low, Math.max(Number(event.target.value), low)])}
        className={cn("range-input", lowPercent > 50 ? "z-10" : "z-20")}
      />
    </div>
  );
}
