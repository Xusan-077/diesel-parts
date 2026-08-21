import Link from "next/link";
import {
  getDashboardCounts,
  getLowStockProducts,
  getRevenueSeries,
  getSalesSummary,
  getSellerPerformance,
} from "@/lib/api/analytics-repository";
import {
  DEFAULT_PERIOD_DAYS,
  PERIOD_OPTIONS,
  buildPeriod,
  cumulative,
  isPeriodDays,
} from "@/lib/analytics/period";
import { formatCompact, formatInteger } from "@/lib/analytics/format";
import { PageHeader } from "@/components/admin/page-header";
import { PanelSection } from "@/components/admin/panel-section";
import { StatTile } from "@/components/admin/stat-tile";
import { TrendChart } from "@/components/admin/trend-chart";
import { RankBar } from "@/components/admin/rank-bar";

const PERIOD_LABEL: Record<number, string> = {
  7: "7 kun",
  30: "30 kun",
  90: "90 kun",
};

export default async function DirectorDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string | string[] }>;
}) {
  const { days: rawDays } = await searchParams;
  const requested = Array.isArray(rawDays) ? rawDays[0] : rawDays;
  const days = isPeriodDays(requested) ? Number(requested) : DEFAULT_PERIOD_DAYS;
  const period = buildPeriod(days);

  const [summary, series, sellers, lowStock, counts] = await Promise.all([
    getSalesSummary(period),
    getRevenueSeries(period),
    getSellerPerformance(period),
    getLowStockProducts(),
    getDashboardCounts(),
  ]);

  const comparison = "oldingi " + days + " kunga nisbatan";

  return (
    <div>
      <PageHeader
        eyebrow="Direktor paneli"
        title="Ko'rsatkichlar"
        actions={
          <nav
            aria-label="Davr"
            className="flex items-center gap-1 rounded-md border border-border p-1"
          >
            {PERIOD_OPTIONS.map((option) => {
              const active = option === days;
              return (
                <Link
                  key={option}
                  href={"/admin/director?days=" + option}
                  aria-current={active ? "true" : undefined}
                  className={
                    "rounded-sm px-3 py-1 font-mono text-xs transition-colors " +
                    (active
                      ? "bg-accent text-accent-foreground"
                      : "text-muted hover:bg-surface-hover hover:text-foreground")
                  }
                >
                  {PERIOD_LABEL[option]}
                </Link>
              );
            })}
          </nav>
        }
      />

      {/*
        * One rhythm for the whole page: 32px between the blocks of a screen.
        * The page used to alternate mt-8 and mt-12 with no rule behind which
        * gap a given seam got. Cards carry their own 24px inside, so the gap
        * between them is the only spacing decision left.
        */}
      <div className="mt-8 space-y-8">
        {/* 4 -> 2 -> 1 columns. Equal gap in both axes, and h-full tiles, so
            the strip stays a strip at every width. */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Daromad"
            value={formatInteger(summary.current.revenue)}
            unit="so'm"
            change={summary.revenueChange}
            comparisonLabel={comparison}
          />
          <StatTile
            label="Buyurtmalar"
            value={formatInteger(summary.current.orders)}
            change={summary.ordersChange}
            comparisonLabel={comparison}
          />
          <StatTile
            label="O'rtacha chek"
            value={formatInteger(summary.averageOrderValue)}
            unit="so'm"
            hint={"Yakunlangan " + formatInteger(summary.current.orders) + " buyurtma bo'yicha"}
          />
          <StatTile
            label="Jarayondagi summa"
            value={formatInteger(summary.pipelineValue)}
            unit="so'm"
            hint="Tasdiqlangan va kutilayotgan buyurtmalar"
          />
        </section>

        <PanelSection
          title="To'plangan daromad"
          description="Davr boshidan qo'shilib boradi; kunlik raqamlar jadval ko'rinishida"
        >
          <TrendChart
            current={cumulative(series.current)}
            previous={cumulative(series.previous)}
            currentDaily={series.current}
            previousDaily={series.previous}
            currentLabel={"Oxirgi " + days + " kun"}
            previousLabel={"Oldingi " + days + " kun"}
          />
        </PanelSection>

        <div className="grid gap-4 lg:grid-cols-2">
          <PanelSection
            title="Sotuvchilar reytingi"
            description="Tanlangan davrdagi yakunlangan savdo"
          >
            <RankBar
              rows={sellers.map((seller) => ({
                id: seller.sellerId,
                label: seller.name,
                value: seller.revenue,
                meta: seller.orders + " ta buyurtma",
              }))}
              emptyMessage="Bu davrda yakunlangan buyurtma yo'q."
            />
          </PanelSection>

          <PanelSection
            title="Kam qolgan zaxira"
            description="Minimal chegaraga yetgan yoki tugagan"
            meta={lowStock.length + " ta"}
            bodyClassName="overflow-x-auto"
          >
            {lowStock.length === 0 ? (
              <p className="type-body text-muted">Hamma mahsulot zaxirasi yetarli.</p>
            ) : (
              <table className="w-full min-w-md text-left text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th scope="col" className="pb-2 font-medium text-muted">Mahsulot</th>
                    <th scope="col" className="pb-2 font-medium text-muted">SKU</th>
                    <th scope="col" className="pb-2 text-right font-medium text-muted">Qoldiq</th>
                    <th scope="col" className="pb-2 text-right font-medium text-muted">Min.</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStock.map((product) => (
                    <tr key={product.id} className="border-b border-border last:border-0">
                      <td className="py-3 pr-3 text-foreground">{product.name}</td>
                      <td className="py-3 pr-3 font-mono text-xs text-muted">{product.sku}</td>
                      <td
                        className={
                          "py-3 text-right font-mono tabular-nums " +
                          (product.stock === 0 ? "text-danger" : "text-foreground")
                        }
                      >
                        {product.stock === 0 ? "tugagan" : formatInteger(product.stock)}
                      </td>
                      <td className="py-3 text-right font-mono tabular-nums text-muted">
                        {formatInteger(product.minStock)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </PanelSection>
        </div>

        <section className="grid gap-4 sm:grid-cols-3">
          <StatTile
            label="Yangi so'rovlar"
            value={formatInteger(counts.newInquiries)}
            hint="Hali sotuvchiga biriktirilmagan"
          />
          <StatTile
            label="Chegirma so'rovlari"
            value={formatInteger(counts.pendingDiscounts)}
            hint="Tasdiqlash kutilmoqda"
          />
          <StatTile
            label="Faol sotuvchilar"
            value={formatInteger(counts.activeSellers)}
            hint={"Davr savdosi " + formatCompact(summary.current.revenue) + " so'm"}
          />
        </section>
      </div>
    </div>
  );
}
