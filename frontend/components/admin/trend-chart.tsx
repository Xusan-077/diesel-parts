"use client";

import { useId, useMemo, useState } from "react";
import type { DayPoint } from "@/lib/analytics/period";
import { formatCompact, formatDayLabel, formatSum } from "@/lib/analytics/format";

/**
 * How this chart's numbers are written.
 *
 * The chart was money-only: `formatSum` and `formatCompact` were called
 * directly, so the axis of an order-count series would have read "12 mln" and
 * its tooltip "4 so'm". The default is still money, so the dashboard's call
 * site is unchanged and the panel keeps one currency treatment.
 *
 * `compact` is for the axis and the dense table cells, `full` for the tooltip
 * and the accessible summary. `unit` is the word appended to the "ahead by"
 * line, and is empty for a unitless count.
 */
export interface ValueFormat {
  compact: (value: number) => string;
  full: (value: number) => string;
  unit: string;
}

export const MONEY_FORMAT: ValueFormat = {
  compact: formatCompact,
  full: formatSum,
  unit: "so'm",
};

const W = 720;
/*
 * The plot was 176px of a 720x220 box — 3.27:1, wide and shallow, which is the
 * shape that flattens every curve drawn in it and leaves a modest week looking
 * like a line pinned to the floor of an empty room. 260 puts the plot at 216px
 * and the frame at 2.77:1, so the same series gets a quarter more vertical
 * travel per unit. That is half the fix for "the low values sit in a lot of
 * empty space"; the other half is the area fill, which makes the region under
 * the curve belong to the mark instead of reading as void.
 *
 * The zero baseline stays. This is a cumulative revenue total, and the distance
 * from the axis to the curve *is* the money — cropping it would overstate the
 * period's growth to make the picture livelier.
 */
const H = 260;
/* left: the widest tick this axis draws is "999,9 mlrd" at 11px.
   right: 24, not 16, so the end-of-period dots have room to sit inside the
   frame rather than half-hanging off it. */
const PAD = { top: 16, right: 24, bottom: 28, left: 60 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

/**
 * Rounds the axis top up to a readable number.
 *
 * The step list is deliberately fine-grained. A coarse one (1, 2, 5, 10) turns a
 * peak of 550M into an axis of 1bn and leaves the curve sitting in the bottom
 * half of an otherwise empty plot.
 */
function niceMax(value: number): number {
  if (value <= 0) {
    return 1;
  }
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    const candidate = step * magnitude;
    if (candidate >= value) {
      return candidate;
    }
  }
  return 10 * magnitude;
}

/**
 * Revenue this period against the one before it.
 *
 * This is an emphasis pair, not two categories: the current window carries the
 * brand hue and the comparison window is deliberately neutral and dashed, so the
 * eye lands on the line that matters. One y-axis, always — both series are the
 * same measure in the same currency.
 *
 * The one thing the reader actually wants off this chart is the *gap* — are we
 * ahead of last month, and by how much — and two lines leave them measuring it
 * by eye. The region between the curves is now filled, with 45° section hatch
 * rather than another wash of colour. Hatch because the area under the current
 * line is already a gradient fill: a second flat fill on top of it turns into
 * mud, while a texture stays legible over anything. It is also the notation an
 * engineering drawing uses for a cut face, which is the right register for a
 * parts wholesaler's dashboard and not a shape borrowed from somewhere else.
 */
export function TrendChart({
  current,
  previous,
  currentDaily,
  previousDaily,
  currentLabel,
  previousLabel,
  format = MONEY_FORMAT,
  measureLabel = "to'plangan daromad",
}: {
  current: DayPoint[];
  previous: DayPoint[];
  /** Per-day figures behind the curve, shown in the table view. */
  currentDaily: DayPoint[];
  previousDaily: DayPoint[];
  currentLabel: string;
  previousLabel: string;
  /** What the series measures. Money unless the call site says otherwise. */
  format?: ValueFormat;
  /** Names the series in the caption and the accessible summary. */
  measureLabel?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  // Two dashboards on one page would otherwise share one gradient id.
  const gradientId = useId();
  const hatchId = useId();

  const { max, xs, currentPath, currentArea, previousPath, gapBand, ticks } = useMemo(() => {
    const peak = Math.max(1, ...current.map((p) => p.value), ...previous.map((p) => p.value));
    const top = niceMax(peak);
    const count = Math.max(current.length, 1);

    const x = (index: number) =>
      count === 1 ? PAD.left + PLOT_W / 2 : PAD.left + (index / (count - 1)) * PLOT_W;
    const y = (value: number) => PAD.top + PLOT_H - (value / top) * PLOT_H;

    const path = (points: DayPoint[]) =>
      points
        .map((point, index) => (index === 0 ? "M" : "L") + x(index) + " " + y(point.value))
        .join(" ");

    const baseline = PAD.top + PLOT_H;
    const lastX = x(Math.max(current.length - 1, 0));

    return {
      max: top,
      xs: current.map((_, index) => x(index)),
      currentPath: path(current),
      previousPath: path(previous),
      /*
       * The same line, closed down to the baseline. Only the current series is
       * filled: two fills would turn an emphasis pair into two categories, and
       * the comparison window is meant to stay in the background.
       */
      currentArea:
        current.length === 0
          ? ""
          : path(current) + " L " + lastX + " " + baseline + " L " + x(0) + " " + baseline + " Z",
      /*
       * The gap: out along the current curve, back along the previous one.
       *
       * Deliberately unsigned. Cumulative revenue curves can cross — a slow
       * start that overtakes late is a real and common shape — and colouring
       * the region green above and red below would draw two conclusions from
       * one continuous quantity, then have to explain the seam. One texture,
       * one meaning: this is the distance between the runs.
       */
      gapBand:
        current.length === 0 || previous.length === 0
          ? ""
          : path(current) +
            " " +
            previous
              .map((point, index) => ({ point, index }))
              .reverse()
              .map(({ point, index }) => "L" + x(index) + " " + y(point.value))
              .join(" ") +
            " Z",
      // Deduped by label: a narrow range rounds several gridlines to the same
      // number, and repeating it says nothing while implying a scale that is
      // finer than the one actually drawn.
      ticks: [0, 0.25, 0.5, 0.75, 1]
        .map((fraction) => ({
          y: PAD.top + PLOT_H - fraction * PLOT_H,
          label: format.compact(top * fraction),
        }))
        .filter((tick, index, all) => index === 0 || tick.label !== all[index - 1].label),
    };
  }, [current, previous, format]);

  const yOf = (value: number) => PAD.top + PLOT_H - (value / max) * PLOT_H;
  const active = hover === null ? null : current[hover];

  /*
   * With nothing sold in either window there is no scale to draw. Rendering the
   * axis anyway produced ticks reading 1, 1, 1, 0, 0 — rounded from fractions of
   * a one-unit range — under a flat line, which looks like a broken chart rather
   * than an empty one.
   */
  const hasData =
    current.some((point) => point.value > 0) || previous.some((point) => point.value > 0);

  if (!hasData) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-foreground">Bu davrda yakunlangan savdo yo&apos;q.</p>
        <p className="mt-1 text-xs text-muted">
          Sotuvchilar buyurtmalarni yopgach, bu yerda {currentLabel.toLowerCase()} va{" "}
          {previousLabel.toLowerCase()} taqqoslanadi.
        </p>
      </div>
    );
  }

  /*
   * The sentence the chart exists to produce, written out.
   *
   * Reading a gap off two curves is work, and the reader does it every time
   * they open the page. The last point of each series is the whole comparison,
   * so it is stated in words above the plot and the hatch shows how the two
   * got there.
   */
  const endCurrent = current[current.length - 1]?.value ?? 0;
  const endPrevious = previous[previous.length - 1]?.value ?? 0;
  const ahead = endCurrent >= endPrevious;
  const gap = Math.abs(endCurrent - endPrevious);

  function onMove(event: React.MouseEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const svgX = ((event.clientX - rect.left) / rect.width) * W;

    if (svgX < PAD.left - 8 || svgX > W - PAD.right + 8 || current.length === 0) {
      setHover(null);
      return;
    }

    let nearest = 0;
    for (let index = 1; index < xs.length; index += 1) {
      if (Math.abs(xs[index] - svgX) < Math.abs(xs[nearest] - svgX)) {
        nearest = index;
      }
    }
    setHover(nearest);
  }

  return (
    <figure className="m-0">
      <figcaption className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
        <span className="flex items-center gap-2 text-foreground">
          <span aria-hidden="true" className="h-0.5 w-5 rounded-full bg-chart-series" />
          {currentLabel}
        </span>
        <span className="flex items-center gap-2 text-muted">
          {/* Dashed, because the mark it stands for is dashed — a solid swatch
              beside a dashed line breaks the only link the reader has. */}
          <svg aria-hidden="true" width="20" height="2" className="overflow-visible">
            <line
              x1="0"
              y1="1"
              x2="20"
              y2="1"
              stroke="var(--chart-context)"
              strokeWidth="2"
              strokeDasharray="5 4"
              strokeLinecap="round"
            />
          </svg>
          {previousLabel}
        </span>
        <span className="flex items-center gap-2 text-muted">
          {/* The swatch carries its own copy of the pattern rather than
              pointing at the plot's. A paint server does resolve across two
              inline SVGs in one document, but only while the one that defines
              it is mounted, and a legend that renders as a hollow box the day
              someone reorders this file is not worth the six saved lines. */}
          <svg aria-hidden="true" width="20" height="10" className="shrink-0">
            <defs>
              <pattern
                id={hatchId + "-key"}
                width="6"
                height="6"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <line x1="0" y1="0" x2="0" y2="6" stroke="var(--chart-hatch)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect
              width="20"
              height="10"
              rx="2"
              fill={"url(#" + hatchId + "-key)"}
              stroke="var(--chart-grid)"
              strokeWidth="1"
            />
          </svg>
          Farq
        </span>

        {/* Pushed to its own end of the caption row: it is the conclusion, not
            a fourth key entry. */}
        <span className="ms-auto font-mono text-xs">
          <span className={ahead ? "text-success" : "text-danger"}>
            <span aria-hidden="true">{ahead ? "↑" : "↓"}</span> {format.compact(gap)} {format.unit}
          </span>{" "}
          <span className="text-muted">{ahead ? "oldinda" : "orqada"}</span>
        </span>
      </figcaption>

      <div className="relative mt-4">
        <svg
          viewBox={"0 0 " + W + " " + H}
          className="w-full"
          role="img"
          aria-label={
            currentLabel +
            " va " +
            previousLabel +
            " bo'yicha " +
            measureLabel +
            ". Davr oxirida farq " +
            format.full(gap) +
            (ahead ? " oldinda." : " orqada.")
          }
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              {/*
               * 0.32 at the curve, not 0.20. The fill has to survive being read
               * on a near-black surface at arm's length, and the old top stop
               * was close enough to the page that the area under the line still
               * read as empty — which was the complaint the taller plot was
               * only half a fix for. It stops at 0.03 rather than 0 so the fill
               * fades into the baseline instead of ending on a visible edge.
               */}
              <stop offset="0%" stopColor="var(--chart-series)" stopOpacity="0.32" />
              <stop offset="70%" stopColor="var(--chart-series)" stopOpacity="0.08" />
              <stop offset="100%" stopColor="var(--chart-series)" stopOpacity="0.03" />
            </linearGradient>

            {/*
             * Section hatch. 45°, 6px pitch, hairline — fine enough to read as
             * a tone from across the room and as a texture up close, which is
             * what keeps it legible on top of the gradient underneath.
             */}
            <pattern
              id={hatchId}
              width="6"
              height="6"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="6"
                stroke="var(--chart-hatch)"
                strokeWidth="1"
                shapeRendering="crispEdges"
              />
            </pattern>
          </defs>

          {ticks.map((tick) => (
            <g key={tick.y}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={tick.y}
                y2={tick.y}
                stroke="var(--chart-grid-faint)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={PAD.left - 10}
                y={tick.y + 3.5}
                textAnchor="end"
                className="fill-muted font-mono text-[10px] tabular-nums"
              >
                {tick.label}
              </text>
            </g>
          ))}

          {/* The zero line is the one rule that is a boundary rather than a
              guide, so it keeps the full-strength grid colour. */}
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={PAD.top + PLOT_H}
            y2={PAD.top + PLOT_H}
            stroke="var(--chart-grid)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />

          <path d={currentArea} fill={"url(#" + gradientId + ")"} stroke="none" />
          <path d={gapBand} fill={"url(#" + hatchId + ")"} stroke="none" />

          <path
            d={previousPath}
            fill="none"
            stroke="var(--chart-context)"
            strokeWidth="2"
            strokeDasharray="5 4"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={currentPath}
            fill="none"
            stroke="var(--chart-series)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />

          {/* Where each run ended. The vertical distance between these two dots
              is exactly the figure printed in the caption. */}
          {current.length > 0 ? (
            <>
              <circle
                cx={xs[xs.length - 1]}
                cy={yOf(endPrevious)}
                r="3"
                fill="var(--chart-context)"
              />
              <circle
                cx={xs[xs.length - 1]}
                cy={yOf(endCurrent)}
                r="4"
                fill="var(--chart-series)"
                stroke="var(--surface)"
                strokeWidth="2"
              />
            </>
          ) : null}

          {hover !== null ? (
            <g>
              <line
                x1={xs[hover]}
                x2={xs[hover]}
                y1={PAD.top}
                y2={PAD.top + PLOT_H}
                stroke="var(--chart-series)"
                strokeWidth="1"
                strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke"
              />
              <circle
                cx={xs[hover]}
                cy={yOf(previous[hover]?.value ?? 0)}
                r="4"
                fill="var(--chart-context)"
                stroke="var(--surface)"
                strokeWidth="2"
              />
              <circle
                cx={xs[hover]}
                cy={yOf(current[hover]?.value ?? 0)}
                r="4.5"
                fill="var(--chart-series)"
                stroke="var(--surface)"
                strokeWidth="2"
              />
            </g>
          ) : null}

          {current.length > 0 ? (
            <>
              <text
                x={PAD.left}
                y={H - 8}
                textAnchor="start"
                className="fill-muted font-mono text-[10px]"
              >
                {formatDayLabel(current[0].day)}
              </text>
              <text
                x={W - PAD.right}
                y={H - 8}
                textAnchor="end"
                className="fill-muted font-mono text-[10px]"
              >
                {formatDayLabel(current[current.length - 1].day)}
              </text>
            </>
          ) : null}
        </svg>

        {active ? (
          <div
            role="status"
            /*
             * `left` is clamped to 8–92%: the card is ~180px inside a plot
             * roughly a thousand wide, so half of it is about 9% and an
             * unclamped tooltip on day one or day thirty was clipped by the
             * panel's own padding.
             */
            className="pointer-events-none absolute -top-2 z-10 min-w-48 -translate-x-1/2 rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-md"
            style={{
              left:
                Math.min(92, Math.max(8, (xs[hover ?? 0] / W) * 100)) + "%",
              borderLeftColor: "var(--chart-series)",
              borderLeftWidth: "2px",
            }}
          >
            <p className="type-eyebrow text-muted">{formatDayLabel(active.day)}</p>
            <p className="mt-2 flex items-baseline justify-between gap-4">
              <span className="text-muted">{currentLabel}</span>
              <span className="font-mono font-medium tabular-nums text-foreground">
                {format.full(active.value)}
              </span>
            </p>
            <p className="mt-1 flex items-baseline justify-between gap-4">
              <span className="text-muted">{previousLabel}</span>
              <span className="font-mono tabular-nums text-muted">
                {format.full(previous[hover ?? 0]?.value ?? 0)}
              </span>
            </p>
            <p className="mt-2 flex items-baseline justify-between gap-4 border-t border-border pt-2">
              <span className="text-muted">Shu kuni</span>
              <span className="font-mono tabular-nums text-muted">
                {format.full(currentDaily[hover ?? 0]?.value ?? 0)}
              </span>
            </p>
          </div>
        ) : null}
      </div>

      {/* The reading of last resort: colour-blind, printed, or screen-read. */}
      <details className="mt-6">
        <summary className="type-caption cursor-pointer text-muted transition-colors hover:text-foreground">
          Jadval ko&apos;rinishi
        </summary>
        <div className="mt-3 max-h-64 overflow-auto rounded-md border border-border">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-surface-muted">
              <tr>
                <th scope="col" className="type-eyebrow px-3 py-2 text-muted">
                  Kun
                </th>
                <th scope="col" className="type-eyebrow px-3 py-2 text-right text-muted">
                  {currentLabel}
                </th>
                <th scope="col" className="type-eyebrow px-3 py-2 text-right text-muted">
                  {previousLabel}
                </th>
              </tr>
            </thead>
            <tbody>
              {currentDaily.map((point, index) => (
                <tr key={point.day} className="row-hover border-t border-border">
                  <td className="px-3 py-2 font-mono text-muted">{formatDayLabel(point.day)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-foreground">
                    {format.compact(point.value)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-muted">
                    {format.compact(previousDaily[index]?.value ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
