"use client";

import { useMemo, useState } from "react";
import type { DayPoint } from "@/lib/analytics/period";
import { formatCompact, formatDayLabel, formatSum } from "@/lib/analytics/format";

const W = 720;
const H = 220;
const PAD = { top: 16, right: 16, bottom: 28, left: 60 };
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
 */
export function TrendChart({
  current,
  previous,
  currentDaily,
  previousDaily,
  currentLabel,
  previousLabel,
}: {
  current: DayPoint[];
  previous: DayPoint[];
  /** Per-day figures behind the curve, shown in the table view. */
  currentDaily: DayPoint[];
  previousDaily: DayPoint[];
  currentLabel: string;
  previousLabel: string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const { max, xs, currentPath, previousPath, ticks } = useMemo(() => {
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

    return {
      max: top,
      xs: current.map((_, index) => x(index)),
      currentPath: path(current),
      previousPath: path(previous),
      ticks: [0, 0.25, 0.5, 0.75, 1].map((fraction) => ({
        y: PAD.top + PLOT_H - fraction * PLOT_H,
        label: formatCompact(top * fraction),
      })),
    };
  }, [current, previous]);

  const yOf = (value: number) => PAD.top + PLOT_H - (value / max) * PLOT_H;
  const active = hover === null ? null : current[hover];

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
      <figcaption className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
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
      </figcaption>

      <div className="relative mt-4">
        <svg
          viewBox={"0 0 " + W + " " + H}
          className="w-full"
          role="img"
          aria-label={currentLabel + " va " + previousLabel + " bo'yicha kunlik daromad"}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          {ticks.map((tick) => (
            <g key={tick.y}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={tick.y}
                y2={tick.y}
                stroke="var(--chart-grid)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={PAD.left - 10}
                y={tick.y + 4}
                textAnchor="end"
                className="fill-muted font-mono text-[11px] tabular-nums"
              >
                {tick.label}
              </text>
            </g>
          ))}

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
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />

          {hover !== null ? (
            <g>
              <line
                x1={xs[hover]}
                x2={xs[hover]}
                y1={PAD.top}
                y2={PAD.top + PLOT_H}
                stroke="var(--chart-context)"
                strokeWidth="1"
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
                className="fill-muted font-mono text-[11px]"
              >
                {formatDayLabel(current[0].day)}
              </text>
              <text
                x={W - PAD.right}
                y={H - 8}
                textAnchor="end"
                className="fill-muted font-mono text-[11px]"
              >
                {formatDayLabel(current[current.length - 1].day)}
              </text>
            </>
          ) : null}
        </svg>

        {active ? (
          <div
            role="status"
            className="pointer-events-none absolute -top-2 z-10 min-w-44 -translate-x-1/2 rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-sm"
            style={{ left: (xs[hover ?? 0] / W) * 100 + "%" }}
          >
            <p className="font-mono text-[11px] text-muted">{formatDayLabel(active.day)}</p>
            <p className="mt-1 flex items-baseline justify-between gap-3">
              <span className="text-muted">{currentLabel}</span>
              <span className="font-mono tabular-nums text-foreground">
                {formatSum(active.value)}
              </span>
            </p>
            <p className="flex items-baseline justify-between gap-3">
              <span className="text-muted">{previousLabel}</span>
              <span className="font-mono tabular-nums text-muted">
                {formatSum(previous[hover ?? 0]?.value ?? 0)}
              </span>
            </p>
            <p className="mt-1 flex items-baseline justify-between gap-3 border-t border-border pt-1">
              <span className="text-muted">Shu kuni</span>
              <span className="font-mono tabular-nums text-muted">
                {formatSum(currentDaily[hover ?? 0]?.value ?? 0)}
              </span>
            </p>
          </div>
        ) : null}
      </div>

      {/* The reading of last resort: colour-blind, printed, or screen-read. */}
      <details className="mt-4">
        <summary className="cursor-pointer text-xs text-muted hover:text-foreground">
          Jadval ko&apos;rinishi
        </summary>
        <div className="mt-3 max-h-64 overflow-auto rounded-md border border-border">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-surface-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium text-muted">
                  Kun
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium text-muted">
                  {currentLabel}
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium text-muted">
                  {previousLabel}
                </th>
              </tr>
            </thead>
            <tbody>
              {currentDaily.map((point, index) => (
                <tr key={point.day} className="border-t border-border">
                  <td className="px-3 py-1.5 font-mono text-muted">{formatDayLabel(point.day)}</td>
                  <td className="px-3 py-1.5 text-right font-mono tabular-nums text-foreground">
                    {formatCompact(point.value)}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono tabular-nums text-muted">
                    {formatCompact(previousDaily[index]?.value ?? 0)}
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
