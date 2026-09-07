"use client";

import { DollarSign, ShoppingCart, Clock, UserPlus } from "lucide-react";
import { useDashboardSummary, useTopProducts } from "@/hooks/seller/queries/use-dashboard";
import { PageHeader } from "@/components/seller/page-header";
import { SectionCard } from "@/components/seller/section-card";
import { StatsCard } from "@/components/seller/stats-card";
import { RankList } from "@/components/seller/rank-list";
import { SalesChart } from "@/components/seller/sales-chart";
import { LowStockAlert } from "@/components/seller/low-stock-alert";
import { QueryErrorState } from "@/components/seller/query-error-state";
import { formatMoney } from "@/lib/seller/format";

export default function SellerDashboardPage() {
  const summary = useDashboardSummary();
  const topProducts = useTopProducts();

  return (
    <div>
      <PageHeader
        title="Boshqaruv paneli"
        description="Bugungi savdo, buyurtmalar va ombor holati."
      />

      <div className="mt-8 space-y-8">
        {summary.isError ? (
          <QueryErrorState error={summary.error} onRetry={() => summary.refetch()} />
        ) : (
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {summary.isLoading || !summary.data ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-32 animate-pulse rounded-lg bg-surface-muted" />
              ))
            ) : (
              <>
                <StatsCard
                  icon={DollarSign}
                  tone="sales"
                  label="Bugungi savdo"
                  value={formatMoney(summary.data.today.sales)}
                  changePercent={summary.data.changeVsPriorPeriod.salesPercent}
                />
                <StatsCard
                  icon={ShoppingCart}
                  tone="orders"
                  label="Bugungi buyurtmalar"
                  value={String(summary.data.today.ordersCount)}
                  changePercent={summary.data.changeVsPriorPeriod.ordersPercent}
                />
                <StatsCard
                  icon={Clock}
                  tone="pending"
                  label="Kutilayotgan buyurtmalar"
                  value={String(summary.data.today.pendingCount)}
                  hint="hozir tayyorlanmoqda"
                />
                <StatsCard
                  icon={UserPlus}
                  tone="customers"
                  label="Yangi mijozlar"
                  value={String(summary.data.today.newCustomers)}
                  changePercent={summary.data.changeVsPriorPeriod.newCustomersPercent}
                />
              </>
            )}
          </section>
        )}

        <div className="grid gap-4 xl:grid-cols-3">
          <SectionCard
            title="So'nggi 30 kunlik savdo"
            className="xl:col-span-2"
          >
            <SalesChart />
          </SectionCard>

          <div className="flex flex-col gap-4">
            <LowStockAlert />
            <SectionCard title="Eng ko'p sotilganlar">
              {topProducts.isError ? (
                <QueryErrorState error={topProducts.error} onRetry={() => topProducts.refetch()} />
              ) : topProducts.isLoading || !topProducts.data ? (
                <div className="flex flex-col gap-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-8 animate-pulse rounded-sm bg-surface-muted" />
                  ))}
                </div>
              ) : topProducts.data.length === 0 ? (
                <p className="type-caption text-muted">Hozircha ma&apos;lumot yo&apos;q</p>
              ) : (
                <RankList
                  formatValue={(value) => `${value} dona`}
                  rows={topProducts.data.map((row, index) => ({
                    id: row.product?.id ?? String(index),
                    label: row.product?.name ?? "—",
                    value: row.quantitySold,
                    meta: `${row.quantitySold} dona sotilgan`,
                  }))}
                />
              )}
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
}
