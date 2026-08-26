import {
  ClipboardList,
  Hourglass,
  Package,
  Percent,
  ReceiptText,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import {
  getDashboardCounts,
  getLowStockProducts,
  getOrderStatusBreakdown,
  getRecentOrders,
  getRevenueSeries,
  getSalesSummary,
  getSellerPerformance,
} from "@/lib/api/analytics-repository";
import {
  DEFAULT_PERIOD_DAYS,
  buildPeriod,
  cumulative,
  isPeriodDays,
  percentChange,
} from "@/lib/analytics/period";
import { formatCompact, formatInteger } from "@/lib/analytics/format";
import { fill } from "@/lib/i18n/panel-dictionary";
import { getPanelLocale } from "@/lib/i18n/panel-locale";
import { PageHeader } from "@/components/admin/page-header";
import { PeriodToggle } from "@/components/admin/period-toggle";
import { StatCard } from "@/components/director/stat-card";
import { PanelCard, SeeAllLink } from "@/components/director/panel-card";
import { RevenueChart } from "@/components/director/revenue-chart";
import { OrderMixChart } from "@/components/director/order-mix-chart";
import { RecentOrdersTable } from "@/components/director/recent-orders-table";
import { LowStockTable } from "@/components/director/low-stock-table";
import { SellerRankList } from "@/components/director/seller-rank-list";
import { EmptyState } from "@/components/director/empty-state";

export default async function DirectorDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string | string[] }>;
}) {
  const { days: rawDays } = await searchParams;
  const requested = Array.isArray(rawDays) ? rawDays[0] : rawDays;
  const days = isPeriodDays(requested) ? Number(requested) : DEFAULT_PERIOD_DAYS;
  const period = buildPeriod(days);

  const { locale, dict } = await getPanelLocale();
  const t = dict.dashboard;

  const [summary, series, sellers, lowStock, counts, mix, recent] = await Promise.all([
    getSalesSummary(period),
    getRevenueSeries(period),
    getSellerPerformance(period),
    getLowStockProducts(),
    getDashboardCounts(),
    getOrderStatusBreakdown(period),
    getRecentOrders(),
  ]);

  const comparison = fill(t.comparison, { days });
  const dayFormat = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  const previousAverage =
    summary.previous.orders === 0 ? 0 : summary.previous.revenue / summary.previous.orders;

  return (
    <div>
      <PageHeader
        eyebrow={t.eyebrow}
        title={t.title}
        actions={
          <PeriodToggle
            days={days}
            hrefFor={(option) => "/director?days=" + option}
            label={t.periodLabel}
            labels={dict.period}
          />
        }
      />

      <div className="mt-8 space-y-8">
        {/* --- Stat cards: Revenue, Orders, Products (Card + Badge) ---------- */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label={t.revenue}
            value={formatInteger(summary.current.revenue)}
            unit={t.currency}
            icon={Wallet}
            change={summary.revenueChange}
            comparisonLabel={comparison}
            noComparisonLabel={t.noComparison}
          />
          <StatCard
            label={t.orders}
            value={formatInteger(summary.current.orders)}
            icon={ReceiptText}
            change={summary.ordersChange}
            comparisonLabel={comparison}
            noComparisonLabel={t.noComparison}
          />
          <StatCard
            label={t.average}
            value={formatInteger(summary.averageOrderValue)}
            unit={t.currency}
            icon={TrendingUp}
            change={percentChange(summary.averageOrderValue, previousAverage)}
            comparisonLabel={comparison}
            hint={fill(t.averageHint, { orders: formatInteger(summary.current.orders) })}
            noComparisonLabel={t.noComparison}
          />
          <StatCard
            label={t.pipeline}
            value={formatInteger(summary.pipelineValue)}
            unit={t.currency}
            icon={Hourglass}
            hint={t.pipelineHint}
          />
        </section>

        {/* --- Revenue Overview chart + order mix ---------------------------- */}
        <div className="grid gap-4 xl:grid-cols-3">
          <PanelCard title={t.trendTitle} description={t.trendDescription} className="xl:col-span-2">
            <RevenueChart
              current={cumulative(series.current)}
              previous={cumulative(series.previous)}
              currentLabel={fill(t.trendCurrent, { days })}
              previousLabel={fill(t.trendPrevious, { days })}
              locale={locale}
            />
          </PanelCard>

          <PanelCard title={t.mixTitle} description={t.mixDescription}>
            <OrderMixChart
              totalLabel={t.orders}
              emptyMessage={t.mixEmpty}
              slices={[
                { id: "completed", label: t.mixCompleted, value: mix.completed, color: "var(--success)" },
                { id: "open", label: t.mixOpen, value: mix.open, color: "var(--chart-series)" },
                { id: "cancelled", label: t.mixCancelled, value: mix.cancelled, color: "var(--danger)" },
              ]}
            />
          </PanelCard>
        </div>

        {/* --- Recent Orders (Table + status Badge) + low stock -------------- */}
        <div className="grid gap-4 lg:grid-cols-2">
          <PanelCard
            title={t.recentTitle}
            description={t.recentDescription}
            action={<SeeAllLink href="/admin/seller/orders" label={t.seeAll} />}
          >
            {recent.length === 0 ? (
              <EmptyState icon={ClipboardList} message={t.recentEmpty} />
            ) : (
              <RecentOrdersTable
                columns={{ customer: t.orders, total: t.revenue, date: t.periodLabel, status: t.statusLabel }}
                rows={recent.map((order) => ({
                  id: order.id,
                  customerName: order.customerName,
                  orderNumber: order.orderNumber,
                  sellerName: order.sellerName,
                  total: formatCompact(order.total),
                  date: dayFormat.format(order.createdAt),
                  status: order.status,
                  statusLabel: dict.status[order.status],
                }))}
              />
            )}
          </PanelCard>

          <PanelCard
            title={t.stockTitle}
            description={t.stockDescription}
            meta={lowStock.length > 0 ? String(lowStock.length) : undefined}
            action={<SeeAllLink href="/director/warehouse" label={t.seeAll} />}
          >
            {lowStock.length === 0 ? (
              <EmptyState icon={Package} message={t.stockEmpty} />
            ) : (
              <LowStockTable
                columns={{ product: t.stockTitle, stock: t.orders, status: t.statusLabel }}
                outOfStockLabel={t.stockOut}
                lowStockLabel={t.stockLow}
                rows={lowStock.map((product) => ({
                  id: product.id,
                  name: product.name,
                  sku: product.sku,
                  stock: product.stock,
                  minStock: product.minStock,
                }))}
              />
            )}
          </PanelCard>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <PanelCard
            title={t.sellersTitle}
            description={t.sellersDescription}
            action={<SeeAllLink href="/director/users" label={t.seeAll} />}
          >
            {sellers.length === 0 ? (
              <EmptyState icon={Users} message={t.sellersEmpty} />
            ) : (
              <SellerRankList
                formatValue={formatCompact}
                rows={sellers.map((seller) => ({
                  id: seller.sellerId,
                  label: seller.name,
                  value: seller.revenue,
                  meta: fill(t.sellerOrders, { count: seller.orders }),
                }))}
              />
            )}
          </PanelCard>

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            <StatCard
              label={t.queueInquiries}
              value={formatInteger(counts.newInquiries)}
              icon={ClipboardList}
              emphasis="quiet"
              hint={t.queueInquiriesHint}
            />
            <StatCard
              label={t.queueDiscounts}
              value={formatInteger(counts.pendingDiscounts)}
              icon={Percent}
              emphasis="quiet"
              hint={t.queueDiscountsHint}
            />
            <StatCard
              label={t.queueSellers}
              value={formatInteger(counts.activeSellers)}
              icon={Users}
              emphasis="quiet"
              hint={fill(t.queueSellersHint, { revenue: formatCompact(summary.current.revenue) })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
