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
import type { OrderStatus } from "@/prisma/generated/prisma/enums";
import type { BadgeProps } from "@/components/ui/badge";
import { PageHeader } from "@/components/admin/page-header";
import { PanelSection, SeeAllLink } from "@/components/admin/panel-section";
import { PanelList, PanelListEmpty } from "@/components/admin/panel-list";
import { PeriodToggle } from "@/components/admin/period-toggle";
import { StatTile } from "@/components/admin/stat-tile";
import { TrendChart } from "@/components/admin/trend-chart";
import { DonutChart } from "@/components/admin/donut-chart";
import { RankBar } from "@/components/admin/rank-bar";

/**
 * Which badge a status wears.
 *
 * Only two statuses earn a colour. COMPLETED is the outcome the whole screen
 * is measuring, and CANCELLED is the one that means the work is gone; the
 * three in between are ordinary progress, and tinting them would spend the
 * page's status palette on "this order is proceeding normally".
 */
const STATUS_TONE: Record<OrderStatus, BadgeProps["variant"]> = {
  COMPLETED: "success",
  CANCELLED: "danger",
  CONFIRMED: "default",
  PENDING: "default",
  DRAFT: "default",
};

/** Two letters from a customer or company name, for the row's avatar. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toLocaleUpperCase() ?? "")
    .join("");
}

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

  /*
   * Dates in the reader's own language, from the platform rather than from a
   * month table in the dictionary. `formatDayLabel` exists for the chart axis
   * and hardcodes Uzbek abbreviations, which is right there — the axis is
   * eleven characters wide and never leaves the panel's own figures — and
   * wrong on a row that sits beside a Russian customer's name.
   */
  const dayFormat = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });

  /*
   * Last period's average order value, and its delta.
   *
   * Both windows' revenue and order counts are already on `summary`, so this is
   * arithmetic on data the page has rather than another query. The tile used to
   * print a hint where the other three printed a comparison, which left the one
   * measure a director is most likely to be asked about — "is the average
   * ticket holding up?" — as the only one on the strip with no answer.
   */
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
            hrefFor={(option) => "/admin/director?days=" + option}
            label={t.periodLabel}
            labels={dict.period}
          />
        }
      />

      {/*
        * One rhythm for the whole page: 32px between the blocks of a screen.
        * Cards carry their own 24px inside, so the gap between them is the only
        * spacing decision left.
        */}
      <div className="mt-8 space-y-8">
        {/* 4 -> 2 -> 1 columns. Equal gap in both axes, and h-full tiles, so
            the strip stays a strip at every width. */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label={t.revenue}
            value={formatInteger(summary.current.revenue)}
            unit={t.currency}
            icon={Wallet}
            change={summary.revenueChange}
            comparisonLabel={comparison}
            noComparisonLabel={t.noComparison}
            gauge={{ value: summary.current.revenue, reference: summary.previous.revenue }}
          />
          <StatTile
            label={t.orders}
            value={formatInteger(summary.current.orders)}
            icon={ReceiptText}
            change={summary.ordersChange}
            comparisonLabel={comparison}
            noComparisonLabel={t.noComparison}
            gauge={{ value: summary.current.orders, reference: summary.previous.orders }}
          />
          <StatTile
            label={t.average}
            value={formatInteger(summary.averageOrderValue)}
            unit={t.currency}
            icon={TrendingUp}
            change={percentChange(summary.averageOrderValue, previousAverage)}
            comparisonLabel={comparison}
            hint={fill(t.averageHint, { orders: formatInteger(summary.current.orders) })}
            noComparisonLabel={t.noComparison}
            gauge={{ value: summary.averageOrderValue, reference: previousAverage }}
          />
          <StatTile
            label={t.pipeline}
            value={formatInteger(summary.pipelineValue)}
            unit={t.currency}
            icon={Hourglass}
            /* Pipeline is a snapshot, not a windowed measure, so there is no
               "previous pipeline" to compare it against. The mark is this
               period's booked revenue instead — a bar past it means more money
               is in flight than has landed — and the hint says so, because an
               unexplained mark is worse than no mark. */
            hint={t.pipelineHint}
            gauge={{
              value: summary.pipelineValue,
              reference: summary.current.revenue,
              tone: "pipeline",
            }}
          />
        </section>

        {/* The period's shape, and how it ended up. The curve gets two thirds
            because it carries a scale and thirty x positions; the ring is three
            numbers and does not grow more legible with width. */}
        <div className="grid gap-4 xl:grid-cols-3">
          <PanelSection
            title={t.trendTitle}
            description={t.trendDescription}
            className="xl:col-span-2"
          >
            <TrendChart
              current={cumulative(series.current)}
              previous={cumulative(series.previous)}
              currentDaily={series.current}
              previousDaily={series.previous}
              currentLabel={fill(t.trendCurrent, { days })}
              previousLabel={fill(t.trendPrevious, { days })}
            />
          </PanelSection>

          <PanelSection title={t.mixTitle} description={t.mixDescription}>
            <DonutChart
              totalLabel={t.orders}
              emptyMessage={t.mixEmpty}
              slices={[
                {
                  id: "completed",
                  label: t.mixCompleted,
                  value: mix.completed,
                  colour: "var(--success)",
                },
                {
                  id: "open",
                  label: t.mixOpen,
                  value: mix.open,
                  colour: "var(--chart-series)",
                },
                {
                  id: "cancelled",
                  label: t.mixCancelled,
                  value: mix.cancelled,
                  colour: "var(--danger)",
                },
              ]}
            />
          </PanelSection>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <PanelSection
            title={t.recentTitle}
            description={t.recentDescription}
            action={<SeeAllLink href="/admin/seller/orders" label={t.seeAll} />}
          >
            {recent.length === 0 ? (
              <PanelListEmpty message={t.recentEmpty} icon={ClipboardList} />
            ) : (
              <PanelList
                rows={recent.map((order) => ({
                  id: order.id,
                  initials: initials(order.customerName),
                  title: order.customerName,
                  meta: order.orderNumber + " · " + order.sellerName,
                  value: formatCompact(order.total),
                  valueMeta: dayFormat.format(order.createdAt),
                  badge: {
                    label: dict.status[order.status],
                    variant: STATUS_TONE[order.status],
                  },
                }))}
              />
            )}
          </PanelSection>

          <PanelSection
            title={t.stockTitle}
            description={t.stockDescription}
            meta={lowStock.length > 0 ? String(lowStock.length) : undefined}
            action={<SeeAllLink href="/admin/director/products" label={t.seeAll} />}
          >
            {lowStock.length === 0 ? (
              <PanelListEmpty message={t.stockEmpty} icon={Package} />
            ) : (
              <PanelList
                rows={lowStock.map((product) => ({
                  id: product.id,
                  icon: Package,
                  title: product.name,
                  meta: product.sku,
                  /* The count carries the figure; the badge carries the
                     verdict. Splitting them is what lets the number stay a
                     number — it used to turn into the word "tugagan" in the
                     same cell, so the column read as figures with a sentence
                     in it. */
                  value: formatInteger(product.stock),
                  /* The count is the figure; the threshold is the context under
                     it. Printing "0 / 4" above "0 / 4 dona" said the same thing
                     twice in one column. */
                  valueMeta: fill(t.stockRemaining, { min: formatInteger(product.minStock) }),
                  badge:
                    product.stock === 0
                      ? { label: t.stockOut, variant: "danger" as const }
                      : { label: t.stockLow, variant: "warning" as const },
                }))}
              />
            )}
          </PanelSection>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <PanelSection
            title={t.sellersTitle}
            description={t.sellersDescription}
            action={<SeeAllLink href="/admin/director/users" label={t.seeAll} />}
          >
            {sellers.length === 0 ? (
              <PanelListEmpty message={t.sellersEmpty} icon={Users} />
            ) : (
              <RankBar
                rows={sellers.map((seller) => ({
                  id: seller.sellerId,
                  label: seller.name,
                  value: seller.revenue,
                  meta: fill(t.sellerOrders, { count: seller.orders }),
                }))}
                emptyMessage={t.sellersEmpty}
              />
            )}
          </PanelSection>

          {/*
            * The queue strip. `emphasis="quiet"` drops these three to the
            * smaller figure step: they are counts of things waiting, not the
            * period's money, and setting a 3 at the same size as 355 000 000
            * was most of why the screen read as one flat field of numbers.
            *
            * Stacked beside the ranking on a wide screen rather than laid
            * across the foot of the page: three small tiles in a column are
            * roughly the height of the ranking card, so the row closes level
            * instead of leaving a band of empty page under the chart.
            */}
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            <StatTile
              label={t.queueInquiries}
              value={formatInteger(counts.newInquiries)}
              icon={ClipboardList}
              emphasis="quiet"
              hint={t.queueInquiriesHint}
            />
            <StatTile
              label={t.queueDiscounts}
              value={formatInteger(counts.pendingDiscounts)}
              icon={Percent}
              emphasis="quiet"
              hint={t.queueDiscountsHint}
            />
            <StatTile
              label={t.queueSellers}
              value={formatInteger(counts.activeSellers)}
              icon={Users}
              emphasis="quiet"
              hint={fill(t.queueSellersHint, {
                revenue: formatCompact(summary.current.revenue),
              })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
