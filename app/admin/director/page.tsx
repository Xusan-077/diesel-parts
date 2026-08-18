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
import { formatCompact, formatInteger, formatSum } from "@/lib/analytics/format";
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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-muted">
            Direktor paneli
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            Ko&apos;rsatkichlar
          </h1>
        </div>

        <nav aria-label="Davr" className="flex items-center gap-1 rounded-md border border-border p-1">
          {PERIOD_OPTIONS.map((option) => {
            const active = option === days;
            return (
              <Link
                key={option}
                href={"/admin/director?days=" + option}
                aria-current={active ? "true" : undefined}
                className={
                  "rounded px-3 py-1 font-mono text-xs transition-colors " +
                  (active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted hover:text-foreground")
                }
              >
                {PERIOD_LABEL[option]}
              </Link>
            );
          })}
        </nav>
      </div>

      <section className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Daromad"
          value={formatSum(summary.current.revenue)}
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
          value={formatSum(summary.averageOrderValue)}
          hint={"Yakunlangan " + formatInteger(summary.current.orders) + " buyurtma bo'yicha"}
        />
        <StatTile
          label="Jarayondagi summa"
          value={formatSum(summary.pipelineValue)}
          hint="Tasdiqlangan va kutilayotgan buyurtmalar"
        />
      </section>

      <section className="mt-12">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">To&apos;plangan daromad</h2>
          <p className="text-xs text-muted">
            Davr boshidan qo&apos;shilib boradi; kunlik raqamlar jadval ko&apos;rinishida
          </p>
        </div>
        <div className="mt-5 rounded-lg border border-border bg-surface p-5">
          <TrendChart
            current={cumulative(series.current)}
            previous={cumulative(series.previous)}
            currentDaily={series.current}
            previousDaily={series.previous}
            currentLabel={"Oxirgi " + days + " kun"}
            previousLabel={"Oldingi " + days + " kun"}
          />
        </div>
      </section>

      <div className="mt-12 grid gap-10 lg:grid-cols-2">
        <section>
          <h2 className="text-sm font-semibold text-foreground">Sotuvchilar reytingi</h2>
          <p className="mt-1 text-xs text-muted">Tanlangan davrdagi yakunlangan savdo</p>
          <div className="mt-5">
            <RankBar
              rows={sellers.map((seller) => ({
                id: seller.sellerId,
                label: seller.name,
                value: seller.revenue,
                meta: seller.orders + " ta buyurtma",
              }))}
              emptyMessage="Bu davrda yakunlangan buyurtma yo'q."
            />
          </div>
        </section>

        <section>
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">Kam qolgan zaxira</h2>
            <p className="font-mono text-xs text-muted">{lowStock.length} ta</p>
          </div>
          <p className="mt-1 text-xs text-muted">Minimal chegaraga yetgan yoki tugagan</p>

          <div className="mt-5 overflow-x-auto">
            {lowStock.length === 0 ? (
              <p className="text-sm text-muted">Hamma mahsulot zaxirasi yetarli.</p>
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
                      <td className="py-2 pr-3 text-foreground">{product.name}</td>
                      <td className="py-2 pr-3 font-mono text-xs text-muted">{product.sku}</td>
                      <td
                        className={
                          "py-2 text-right font-mono tabular-nums " +
                          (product.stock === 0 ? "text-danger" : "text-foreground")
                        }
                      >
                        {product.stock === 0 ? "tugagan" : formatInteger(product.stock)}
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums text-muted">
                        {formatInteger(product.minStock)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>

      <section className="mt-12 grid gap-6 border-t border-border pt-8 sm:grid-cols-3">
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
  );
}
