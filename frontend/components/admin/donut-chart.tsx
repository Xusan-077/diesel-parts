import { formatInteger } from "@/lib/analytics/format";

export interface DonutSlice {
  id: string;
  label: string;
  value: number;
  /** A CSS colour, normally a token: `var(--success)`. */
  colour: string;
}

const SIZE = 120;
const STROKE = 16;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * A part-to-whole reading of a small, fixed set.
 *
 * A donut and not a bar chart, and the heuristic that decides it is the
 * question: nobody asks whether there were more completed orders than
 * cancelled ones — they ask what share of the period's orders landed. That is
 * the one job a ring does better than a row of bars, and it only holds while
 * the set is three or four slices that sum to a meaningful whole. A fifth
 * category or a set that does not add up belongs in `RankBar`.
 *
 * The hole is not decoration: the total goes in it, so the reader gets the
 * denominator without a caption. Every slice is also written out beneath with
 * its own figure and share, which is the reading of last resort for a
 * colour-blind reader, a printout, or a screen reader — the ring itself is
 * `aria-hidden`, since it would otherwise be announced as an image saying
 * nothing the list below does not.
 *
 * Slices are drawn with `stroke-dasharray` on one circle rather than as arc
 * paths. Same picture, no trigonometry, and a zero-value category collapses to
 * nothing instead of leaving a hairline wedge that reads as "a few".
 */
export function DonutChart({
  slices,
  totalLabel,
  emptyMessage,
}: {
  slices: DonutSlice[];
  /** Sits under the total in the hole — what the number counts. */
  totalLabel: string;
  emptyMessage: string;
}) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);

  if (total === 0) {
    return <p className="type-body py-8 text-center text-muted">{emptyMessage}</p>;
  }

  /*
   * Each arc's start is the sum of everything before it. Computed from the
   * index rather than by carrying a running total across the map, so the
   * expression stays a pure function of `slices` — with three entries the
   * quadratic walk is free, and a rolling accumulator here is the kind of
   * shared mutable state that stops being free the day someone reorders the
   * list.
   */
  const arcs = slices.map((slice, index) => {
    const before = slices
      .slice(0, index)
      .reduce((sum, earlier) => sum + earlier.value, 0);

    return {
      ...slice,
      length: (slice.value / total) * CIRCUMFERENCE,
      offset: (before / total) * CIRCUMFERENCE,
    };
  });

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative">
        <svg
          aria-hidden="true"
          width={SIZE}
          height={SIZE}
          viewBox={"0 0 " + SIZE + " " + SIZE}
          /* -90° so the first slice starts at twelve o'clock, which is where a
             reader's eye enters a ring. */
          className="-rotate-90"
        >
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--gauge-track)"
            strokeWidth={STROKE}
          />
          {arcs.map((arc) =>
            arc.value === 0 ? null : (
              <circle
                key={arc.id}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={arc.colour}
                strokeWidth={STROKE}
                strokeDasharray={arc.length + " " + (CIRCUMFERENCE - arc.length)}
                strokeDashoffset={-arc.offset}
              />
            ),
          )}
        </svg>

        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <p className="text-center">
            <span className="type-figure-sm block text-foreground">
              {formatInteger(total)}
            </span>
            <span className="type-eyebrow block text-muted">{totalLabel}</span>
          </p>
        </div>
      </div>

      {/* The figures, directly labelled. Each swatch is a square rather than a
          dot so it reads at 8px, and the share is printed because "how much of
          the whole" is the question the ring was drawn to answer. */}
      <ul className="flex w-full flex-col gap-2">
        {slices.map((slice) => (
          <li key={slice.id} className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0 rounded-xs"
              style={{ backgroundColor: slice.colour }}
            />
            <span className="type-body min-w-0 flex-1 truncate text-muted">{slice.label}</span>
            <span className="shrink-0 font-mono text-sm font-medium tabular-nums text-foreground">
              {formatInteger(slice.value)}
            </span>
            <span className="type-caption w-12 shrink-0 text-right font-mono tabular-nums text-muted">
              {Math.round((slice.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
