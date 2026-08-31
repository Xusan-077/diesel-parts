"use client";

import { useState } from "react";
import { cumulative, type DayPoint } from "@/lib/analytics/period";
import { formatCompact, formatDelta, formatInteger, formatSum } from "@/lib/analytics/format";
import type { SalesMetric } from "@/lib/api/analytics-detail-repository";
import { ExportButton } from "@/components/admin/export-button";
import { MONEY_FORMAT, TrendChart, type ValueFormat } from "@/components/admin/trend-chart";
import { cn } from "@/lib/utils";

/** The shape the page hands over: one series per measure, already aligned. */
export interface ChartMetricSeries {
  current: DayPoint[];
  previous: DayPoint[];
  currentTotal: number;
  previousTotal: number;
  change: number | null;
}

const COUNT_FORMAT: ValueFormat = {
  compact: formatInteger,
  full: (value) => formatInteger(value) + " ta",
  unit: "ta",
};

/*
 * Three measures, not four. The brief asked for profit as well, and there is no
 * purchase price anywhere in the schema to compute it from — see the note at
 * the foot of `analytics-detail-repository.ts`. A profit line drawn from a cost
 * nobody has entered would be a number a director acts on.
 */
const METRICS: readonly {
  key: SalesMetric;
  label: string;
  /** Whether the chart accumulates across the window or plots each day. */
  cumulative: boolean;
  format: ValueFormat;
  measureLabel: string;
  summary: (total: number) => string;
}[] = [
  {
    key: "revenue",
    label: "Daromad",
    cumulative: true,
    format: MONEY_FORMAT,
    measureLabel: "to'plangan daromad",
    summary: formatSum,
  },
  {
    key: "orders",
    label: "Buyurtmalar",
    cumulative: true,
    format: COUNT_FORMAT,
    measureLabel: "to'plangan buyurtmalar soni",
    summary: (total) => formatInteger(total) + " ta",
  },
  {
    key: "average",
    label: "O'rtacha chek",
    /*
     * The one measure that is not accumulated. Revenue and order count are
     * quantities, and their running total answers "are we ahead of last
     * month". An average is already a ratio — accumulating it would draw the
     * sum of daily averages, which is not a figure that means anything.
     */
    cumulative: false,
    format: MONEY_FORMAT,
    measureLabel: "kunlik o'rtacha chek",
    summary: formatSum,
  },
];

/**
 * The period's shape, with the measure switchable.
 *
 * One chart with a switcher rather than three charts stacked: the three
 * measures share an x-axis and a comparison window, and reading them as one
 * curve at a time is what makes a divergence visible — revenue flat while the
 * order count climbs is the average ticket falling, and that is a sentence a
 * reader can only assemble if the two views are in the same place.
 *
 * The switcher is a tab list, and the tab is what the chart is *about*, so it
 * carries the period total for that measure. Reading the strip alone answers
 * the three headline questions without touching the chart at all.
 */
export function SalesChart({
  series,
  periodLabel,
  previousLabel,
  filename,
}: {
  series: Record<SalesMetric, ChartMetricSeries>;
  periodLabel: string;
  previousLabel: string;
  filename: string;
}) {
  const [active, setActive] = useState<SalesMetric>("revenue");
  const metric = METRICS.find((entry) => entry.key === active) ?? METRICS[0];
  const data = series[metric.key];

  const plotted = metric.cumulative
    ? { current: cumulative(data.current), previous: cumulative(data.previous) }
    : { current: data.current, previous: data.previous };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div
          role="tablist"
          aria-label="Ko'rsatkich"
          className="flex flex-wrap gap-2"
        >
          {METRICS.map((entry) => {
            const selected = entry.key === metric.key;
            const delta = formatDelta(series[entry.key].change);

            return (
              <button
                key={entry.key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActive(entry.key)}
                className={cn(
                  "rounded-md border px-3 py-2 text-left transition-colors",
                  selected
                    ? // The selected tab is raised on the page rather than
                      // filled with the accent: the accent is already spending
                      // itself on the chart's own series line, and two oranges
                      // on one card give the reader nowhere to look first.
                      "border-accent-edge bg-accent-subtle"
                    : "border-border hover:bg-surface-hover",
                )}
              >
                <span className="type-eyebrow block text-muted">{entry.label}</span>
                <span className="mt-1 block font-mono text-sm font-semibold tabular-nums text-foreground">
                  {entry.summary(series[entry.key].currentTotal)}
                </span>
                {delta === null ? (
                  <span className="mt-1 block text-xs text-muted">solishtirish yo&apos;q</span>
                ) : (
                  <span
                    className={cn(
                      "mt-1 block font-mono text-xs tabular-nums",
                      series[entry.key].change! >= 0 ? "text-success" : "text-danger",
                    )}
                  >
                    {/* The arrow, not the colour, is what carries the direction
                        for a reader who cannot separate the two hues. */}
                    <span aria-hidden>{series[entry.key].change! >= 0 ? "↑" : "↓"}</span> {delta}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <ExportButton
          columns={[
            { header: "Sana", value: (row: DayPoint) => row.day },
            { header: metric.label, value: (row: DayPoint) => Math.round(row.value) },
          ]}
          rows={data.current}
          filename={filename}
          label="CSV"
        />
      </div>

      <div className="mt-6">
        <TrendChart
          key={metric.key}
          current={plotted.current}
          previous={plotted.previous}
          currentDaily={data.current}
          previousDaily={data.previous}
          currentLabel={periodLabel}
          previousLabel={previousLabel}
          format={metric.format}
          measureLabel={metric.measureLabel}
        />
      </div>

      {metric.cumulative ? null : (
        /* Said only on the measure it applies to. A permanent note explaining
           that two of three views accumulate is noise on the two where it is
           obvious from the curve. */
        <p className="mt-3 text-xs text-muted">
          O&apos;rtacha chek kunma-kun ko&apos;rsatiladi — to&apos;planmaydi.{" "}
          <span className="font-mono tabular-nums">
            Davr o&apos;rtachasi: {formatCompact(data.currentTotal)} so&apos;m
          </span>
        </p>
      )}
    </div>
  );
}
