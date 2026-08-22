/**
 * Counting a headline figure up from zero.
 *
 * The figures on the home page are written into their own sentences —
 * "30+ yil tajriba", "10,000+ mahsulot" — rather than sitting in a numeric
 * field, because that is how they read and how a translator wants them. So the
 * number has to be found in the string rather than handed over, and put back
 * formatted exactly as it was written: a count that ends on "10000" where the
 * copy says "10,000" has changed the copy.
 */

export interface LeadingNumber {
  /** The value to count to. */
  value: number;
  /** The digits exactly as written, e.g. "10,000". */
  text: string;
  /** Everything after the number, e.g. "+ mahsulot". */
  rest: string;
  /** The thousands separator used, so intermediate values match. */
  separator: string;
}

/**
 * Reads a figure off the front of a label.
 *
 * Only the front: a number in the middle of a sentence is part of the sentence,
 * not a statistic, and animating it would be animating prose. `null` when there
 * is nothing to count, which is the answer for "OEM sifat" and most copy.
 */
export function splitLeadingNumber(label: string): LeadingNumber | null {
  const match = /^(\d[\d\s,. ]*\d|\d)/.exec(label.trim());
  if (!match) {
    return null;
  }

  const text = match[1];
  // Anything that is not a digit and appears between digits is grouping.
  const separator = /\d([\s,. ])\d/.exec(text)?.[1] ?? "";
  const digits = text.replace(/\D/g, "");
  const value = Number.parseInt(digits, 10);

  if (!Number.isFinite(value)) {
    return null;
  }

  return {
    value,
    text,
    rest: label.trim().slice(text.length),
    separator,
  };
}

/**
 * Formats an intermediate value with the separator the copy already used.
 *
 * Written by hand rather than through `Intl`: the point is to match what the
 * translator typed, and `Intl` would impose its own idea of grouping for the
 * locale — which is how "10,000+ mahsulot" would count up and land on
 * "10 000+ mahsulot".
 */
export function groupWith(value: number, separator: string): string {
  const digits = String(Math.max(0, Math.round(value)));
  if (separator === "") {
    return digits;
  }
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}

/**
 * Eased progress, 0 to 1.
 *
 * Fast at the start and settling at the end — the shape of a counter that has
 * a number to announce rather than a bar that is loading. Linear counting
 * reads as a stopwatch.
 */
export function easeOutCubic(progress: number): number {
  const clamped = Math.min(1, Math.max(0, progress));
  return 1 - Math.pow(1 - clamped, 3);
}

/** How long a figure takes to arrive. Long enough to notice, short enough to read. */
export const COUNT_UP_MS = 1100;

/**
 * The value shown at a moment in the run.
 *
 * Rounded up rather than to nearest, so a counter with a small target does not
 * spend its opening frames showing zero. The trade is at the other end: for a
 * target like 15 the ceiling reaches it before the easing does, and the last
 * stretch holds steady. That is the right way round — a figure that settles
 * early still reads as arriving, and one that starts at 0 for a third of a
 * second reads as broken.
 */
export function valueAt(elapsedMs: number, target: number, durationMs = COUNT_UP_MS): number {
  if (durationMs <= 0 || elapsedMs >= durationMs) {
    return target;
  }
  return Math.ceil(easeOutCubic(elapsedMs / durationMs) * target);
}
