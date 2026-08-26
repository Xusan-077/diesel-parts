"use client";

import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/shadcn/chart";
import type { DayPoint } from "@/lib/analytics/period";
import { formatCompact } from "@/lib/analytics/format";

export interface RevenueChartProps {
  current: readonly DayPoint[];
  previous: readonly DayPoint[];
  currentLabel: string;
  previousLabel: string;
  /**
   * A locale tag, not a formatter function: a Server Component can only pass
   * plain, serialisable props to a Client Component like this one, and a
   * closure crosses that boundary as neither data nor a server action.
   */
  locale: string;
}

/**
 * The Revenue Overview chart: an accent-coloured area over the period, with
 * last period's curve underneath it in outline for scale. Real data in —
 * `series.current`/`series.previous` from `getRevenueSeries()`, the same
 * query the old `TrendChart` read — only the rendering changed.
 *
 * `--color-accent` rather than shadcn's own `--chart-1..5`: this panel has
 * one brand hue, not a five-colour categorical set, and the brief asks for
 * the accent explicitly ("Recharts grafiklarni accent rangda").
 */
export function RevenueChart({
  current,
  previous,
  currentLabel,
  previousLabel,
  locale,
}: RevenueChartProps) {
  const data = current.map((point, index) => ({
    day: point.day,
    current: point.value,
    previous: previous[index]?.value ?? null,
  }));

  const dayFormat = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  const formatDay = (day: string) => dayFormat.format(new Date(day));

  const config = {
    current: { label: currentLabel, color: "var(--accent)" },
    previous: { label: previousLabel, color: "var(--border-strong)" },
  } satisfies ChartConfig;

  return (
    <ChartContainer config={config} className="aspect-auto h-72 w-full">
      <AreaChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="director-revenue-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border-subtle)" />
        <XAxis
          dataKey="day"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={formatDay}
          minTickGap={24}
        />
        <ChartTooltip
          cursor={{ stroke: "var(--border-strong)", strokeDasharray: "3 3" }}
          content={
            <ChartTooltipContent
              labelFormatter={(label) => formatDay(String(label))}
              formatter={(value, name) => [
                " " + formatCompact(Number(value)),
                (config[name as keyof typeof config]?.label ?? name) as string,
              ]}
            />
          }
        />
        <Area
          dataKey="previous"
          type="monotone"
          stroke="var(--border-strong)"
          strokeDasharray="4 4"
          fill="none"
          strokeWidth={1.5}
        />
        <Area
          dataKey="current"
          type="monotone"
          stroke="var(--accent)"
          fill="url(#director-revenue-fill)"
          strokeWidth={2}
        />
      </AreaChart>
    </ChartContainer>
  );
}
