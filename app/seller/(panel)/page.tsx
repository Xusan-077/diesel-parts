"use client";

import { DollarSign, ShoppingCart, Clock, UserPlus } from "lucide-react";
import { useDashboardSummary, useTopProducts } from "@/hooks/seller/queries/use-dashboard";
import { StatsCard } from "@/components/seller/stats-card";
import { SalesChart } from "@/components/seller/sales-chart";
import { LowStockAlert } from "@/components/seller/low-stock-alert";
import { QueryErrorState } from "@/components/seller/query-error-state";
import { formatMoney } from "@/lib/seller/format";

export default function SellerDashboardPage() {
  const summary = useDashboardSummary();
  const topProducts = useTopProducts();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-foreground">Boshqaruv paneli</h1>

      {summary.isError ? (
        <QueryErrorState error={summary.error} onRetry={() => summary.refetch()} />
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {summary.isLoading || !summary.data ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-md bg-surface-muted" />
            ))
          ) : (
            <>
              <StatsCard
                icon={DollarSign}
                label="Bugungi savdo"
                value={formatMoney(summary.data.today.sales)}
                changePercent={summary.data.changeVsPriorPeriod.salesPercent}
              />
              <StatsCard
                icon={ShoppingCart}
                label="Bugungi buyurtmalar"
                value={String(summary.data.today.ordersCount)}
                changePercent={summary.data.changeVsPriorPeriod.ordersPercent}
              />
              <StatsCard icon={Clock} label="Kutilayotgan buyurtmalar" value={String(summary.data.today.pendingCount)} />
              <StatsCard
                icon={UserPlus}
                label="Yangi mijozlar"
                value={String(summary.data.today.newCustomers)}
                changePercent={summary.data.changeVsPriorPeriod.newCustomersPercent}
              />
            </>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-md border border-border bg-surface p-4 lg:col-span-2">
          <p className="mb-4 text-sm font-medium text-foreground">So&apos;nggi 30 kunlik savdo</p>
          <SalesChart />
        </div>
        <div className="flex flex-col gap-4">
          <LowStockAlert />
          <div className="rounded-md border border-border bg-surface p-4">
            <p className="mb-3 text-sm font-medium text-foreground">Eng ko&apos;p sotilganlar</p>
            {topProducts.isError ? (
              <QueryErrorState error={topProducts.error} onRetry={() => topProducts.refetch()} />
            ) : topProducts.isLoading || !topProducts.data ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-5 animate-pulse rounded-sm bg-surface-muted" />
                ))}
              </div>
            ) : topProducts.data.length === 0 ? (
              <p className="text-xs text-muted">Hozircha ma&apos;lumot yo&apos;q</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {topProducts.data.map((row, index) => (
                  <li key={row.product?.id ?? index} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-foreground">{row.product?.name ?? "—"}</span>
                    <span className="shrink-0 font-mono text-xs text-muted">{row.quantitySold} dona</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
