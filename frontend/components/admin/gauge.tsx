/**
 * The peak-hold gauge.
 *
 * A boost gauge on a diesel carries two needles: a live one, and a peak-hold
 * needle parked at the highest reading of the last run. You do not read the
 * numbers to know how the run went — you read whether the live needle has
 * passed the mark.
 *
 * That is exactly the question the top of this dashboard exists to answer, and
 * the screen was answering it with the string "↓ -29%". A percentage is precise
 * and slow: it tells you the size of the gap only after you have found the
 * figure it applies to. The bar and the mark tell you the direction before you
 * have read a digit, and the percentage is still printed above for the size.
 *
 * Why this and not a sparkline. Only one of the four headline measures has a
 * per-day series behind it — revenue — and putting a spark on that tile alone
 * would make the strip read as three tiles with something missing. Every one of
 * the four has a previous-period figure, so every one of them can carry this.
 *
 * Decorative by construction: `value` and `reference` are both already printed
 * as text on the tile, so the gauge is `aria-hidden` and adds nothing a screen
 * reader has to hear twice.
 */

export type GaugeTone = "revenue" | "pipeline";

const TONE: Record<GaugeTone, string> = {
  /* The revenue hue — the same one the trend chart draws its current series
     in, so a bar on a tile and the line below it are recognisably the same
     measure. */
  revenue: "var(--chart-series)",
  /* Money agreed but not yet banked. Gold-olive rather than orange, because
     the pipeline is a different kind of number from revenue and reading the
     two bars as one measure would be the wrong conclusion. */
  pipeline: "var(--warning)",
};


/**
 * The larger of the two readings is drawn at 88% of the track, not 100%.
 *
 * A bar that ends flush with its container reads as "full" — a capped meter
 * rather than an open scale — and the peak mark would sit on the track's own
 * rounded end where it stops looking like a mark. The headroom keeps both
 * legible as positions on a scale that continues.
 */
const FULL = 0.88;

export function Gauge({
  value,
  reference,
  tone = "revenue",
}: {
  value: number;
  /** Last period's reading. The mark. */
  reference: number;
  tone?: GaugeTone;
}) {
  const peak = Math.max(value, reference, 0);
  // Nothing in either window: a track with no bar and no mark says "no trade"
  // more honestly than a bar of width zero pinned to the left edge.
  const scale = peak <= 0 ? 0 : FULL / peak;

  const barWidth = Math.max(0, value) * scale;
  const markAt = Math.max(0, reference) * scale;
  const colour = TONE[tone];

  return (
    /*
     * `mt-4` and no `overflow-hidden`: the mark is taller than the track and
     * has to be allowed out of it. The bar is rounded to the same radius and
     * starts flush at the left edge, so it needs no clipping either.
     */
    <div
      aria-hidden="true"
      className="relative mt-4 h-1 w-full rounded-xs"
      style={{ backgroundColor: "var(--gauge-track)" }}
    >
      <div
        className="absolute inset-y-0 left-0 rounded-xs"
        style={{ width: barWidth * 100 + "%", backgroundColor: colour }}
      />

      {/*
       * The mark is only drawn when there was a previous reading to hold. At
       * reference 0 it would sit on the left edge, where it reads as the start
       * of the track rather than as a comparison — the tile prints "no
       * comparison" in words instead.
       */}
      {reference > 0 ? (
        /*
         * A needle that stands proud of the track, not a stripe painted into
         * it. A flat mark has to contrast with two different grounds at once —
         * the track and the bar — in two themes, and no single colour does:
         * the page background matches the track almost exactly in light mode,
         * and the foreground ink sits at about 2:1 on the orange bar in dark.
         * Standing 4px clear at both ends puts most of the mark on the card's
         * own surface, where `--foreground` is 16:1 either way, and the
         * crossing over the bar becomes a detail rather than the whole signal.
         */
        <span
          className="absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded-full bg-foreground"
          style={{ left: Math.min(100, markAt * 100) + "%" }}
        />
      ) : null}
    </div>
  );
}
