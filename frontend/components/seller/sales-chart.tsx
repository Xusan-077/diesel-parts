"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useSalesChart } from "@/hooks/seller/queries/use-dashboard";
import { QueryErrorState } from "@/components/seller/query-error-state";
import { formatMoney } from "@/lib/seller/format";

export function SalesChart() {
  const { data, isLoading, isError, error, refetch } = useSalesChart();

  if (isError) {
    return <QueryErrorState error={error} onRetry={() => refetch()} />;
  }

  if (isLoading || !data) {
    return <div className="h-64 w-full animate-pulse rounded-md bg-surface-muted" />;
  }

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-md border border-dashed border-border text-sm text-muted">
        So&apos;nggi 30 kunda sotuv yo&apos;q
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={256}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="sellerSalesFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--color-border)" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(value: string) => value.slice(5)}
          tick={{ fill: "var(--color-muted)", fontSize: 11 }}
          axisLine={{ stroke: "var(--color-border)" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "var(--color-muted)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={40}
          tickFormatter={(value: number) => (value >= 1_000_000 ? `${Math.round(value / 1_000_000)}M` : `${value}`)}
        />
        <Tooltip
          contentStyle={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: 6,
            fontSize: 12,
          }}
          labelStyle={{ color: "var(--color-muted)" }}
          formatter={(value) => [formatMoney(Number(value)), "Sotuv"]}
        />
        <Area type="monotone" dataKey="total" stroke="var(--color-accent)" strokeWidth={2} fill="url(#sellerSalesFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
