"use client";

import { Cell, Pie, PieChart } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/shadcn/chart";
import { formatInteger } from "@/lib/analytics/format";

export interface OrderMixSlice {
  id: string;
  label: string;
  value: number;
  color: string;
}

/** The period's order mix as a donut — real data from `getOrderStatusBreakdown()`. */
export function OrderMixChart({
  slices,
  totalLabel,
  emptyMessage,
}: {
  slices: readonly OrderMixSlice[];
  totalLabel: string;
  emptyMessage: string;
}) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);

  if (total === 0) {
    return (
      <p className="type-body flex h-full min-h-40 items-center justify-center text-center text-muted">
        {emptyMessage}
      </p>
    );
  }

  const config = Object.fromEntries(
    slices.map((slice) => [slice.id, { label: slice.label, color: slice.color }]),
  ) satisfies ChartConfig;

  return (
    <div className="flex items-center gap-6">
      <div className="relative shrink-0">
        <ChartContainer config={config} className="aspect-square h-36 w-36">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <Pie
              data={slices as OrderMixSlice[]}
              dataKey="value"
              nameKey="id"
              innerRadius={46}
              outerRadius={66}
              strokeWidth={2}
            >
              {slices.map((slice) => (
                <Cell key={slice.id} fill={slice.color} stroke="var(--surface)" />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="type-figure-sm text-foreground">{formatInteger(total)}</span>
          <span className="type-caption text-muted">{totalLabel}</span>
        </div>
      </div>

      <ul className="flex flex-1 flex-col gap-2">
        {slices.map((slice) => (
          <li key={slice.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 text-muted">
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: slice.color }}
              />
              {slice.label}
            </span>
            <span className="font-mono tabular-nums text-foreground">
              {formatInteger(slice.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
