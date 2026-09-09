import { ShoppingCart, Users } from "lucide-react";
import {
  getCustomerAnalytics,
  getInventorySummary,
  getProductMovement,
  getSalesSeries,
  getSellerScorecards,
} from "@/lib/api/analytics-detail-repository";
import { resolvePeriod } from "@/lib/analytics/period";
import { formatInteger } from "@/lib/analytics/format";
import { csvFilename } from "@/lib/analytics/csv";
import { PageHeader } from "@/components/admin/page-header";
import { AnalyticsPeriod } from "@/components/admin/analytics-period";
import { DonutChart } from "@/components/admin/donut-chart";
import { InventoryPanel } from "@/components/admin/inventory-panel";
import { DeadStockTable, FastMovingTable } from "@/components/admin/movement-tables";
import { RankBar } from "@/components/admin/rank-bar";
import { SalesChart } from "@/components/admin/sales-chart";
import { SellerScorecardTable } from "@/components/admin/seller-scorecard-table";
import { TopCustomersTable } from "@/components/admin/top-customers-table";
import { HeroStats } from "@/components/director/hero-stats";
import { PanelCard } from "@/components/director/panel-card";
import { SectionHeading } from "@/components/director/section-heading";
import { EmptyState } from "@/components/director/empty-state";
import { AnalyticsGaps } from "@/components/director/analytics-gaps";

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * The screen for asking a specific question, as opposed to the dashboard's
 * at-a-glance answer to "how are we doing".
 *
 * It is a separate route rather than more cards on the dashboard for two
 * reasons. The dashboard's job is to be readable in five seconds on login, and
 * every section added to it costs that; and these queries are wider — a per-day
 * breakdown of three measures, a movement ranking across every order line in
 * the window — which nobody should pay for on a screen they only glanced at.
 *
 * The window is resolved once, at the top, and handed to every query. Each
 * section deciding its own period is how a page ends up with a chart and a
 * table quietly describing different months.
 *
 * ── Reading order ────────────────────────────────────────────────────────────
 * The page is one hierarchy, not four equal panels:
 *   1  Savdo   — the hero figures and the dynamics chart. What a director came
 *      to check, set loudest.
 *   2  Ombor   — three drill-in figures and the movement pair, on white cards.
 *   3  Xodimlar / Mijozlar — supporting detail, on the page's recessed ground
 *      so the eye reads them as secondary.
 *   ·  and the honest footer of what cannot be computed yet, quietest of all.
 */
export default async function DirectorAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const { period, custom } = resolvePeriod({
    days: firstParam(params.days),
    from: firstParam(params.from),
    to: firstParam(params.to),
  });

  const [sales, inventory, movement, sellers, customers] = await Promise.all([
    getSalesSeries(period),
    getInventorySummary(),
    getProductMovement(period),
    getSellerScorecards(period),
    getCustomerAnalytics(period),
  ]);

  const windowLabel = custom
    ? formatInteger(period.days) + " kun (tanlangan oraliq)"
    : period.days === 1
      ? "Bugun"
      : formatInteger(period.days) + " kun";

  const comparisonLabel = "oldingi davrga nisbatan";
  const customerTotal = customers.newCustomers + customers.returningCustomers;

  return (
    <div>
      <PageHeader
        eyebrow="Direktor paneli"
        title="Analitika"
        description="Savdo, ombor, xodimlar va mijozlar — tanlangan davr bo'yicha."
        actions={
          <AnalyticsPeriod
            days={period.days}
            from={period.from}
            to={period.to}
            custom={custom}
          />
        }
      />

      <div className="mt-8 space-y-12">
        {/* ── Level 1 · Savdo ──────────────────────────────────────────────── */}
        <section className="space-y-4">
          <HeroStats
            items={[
              {
                id: "revenue",
                label: "Daromad",
                value: formatInteger(sales.revenue.currentTotal),
                unit: "so'm",
                change: sales.revenue.change,
                comparisonLabel,
                noComparisonLabel: "solishtirish uchun oldingi davr yo'q",
              },
              {
                id: "orders",
                label: "Buyurtmalar",
                value: formatInteger(sales.orders.currentTotal),
                unit: "ta",
                change: sales.orders.change,
                comparisonLabel,
                noComparisonLabel: "solishtirish uchun oldingi davr yo'q",
              },
              {
                id: "average",
                label: "O'rtacha chek",
                value: formatInteger(sales.average.currentTotal),
                unit: "so'm",
                change: sales.average.change,
                comparisonLabel,
                noComparisonLabel: "solishtirish uchun oldingi davr yo'q",
              },
            ]}
          />

          <PanelCard
            title="Savdo dinamikasi"
            description="Ko'rsatkichni tanlang — grafik o'sha o'lchovga o'tadi. Uzuq chiziq — oldingi davr."
          >
            <SalesChart
              series={sales}
              periodLabel={windowLabel}
              previousLabel="Oldingi davr"
              filename={csvFilename("savdo", period.from, period.to)}
              compact
            />
          </PanelCard>
        </section>

        {/* ── Level 2 · Ombor ─────────────────────────────────────────────── */}
        <section className="space-y-4">
          <SectionHeading
            title="Ombor"
            description="Shelf holati va davr ichidagi harakat. Raqamlar bosiladi — orqasidagi ro'yxat ochiladi."
          />

          <InventoryPanel
            summary={inventory}
            windowFrom={period.from}
            windowTo={period.to}
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <PanelCard
              title="Tez sotiladigan"
              description="Davr ichida eng ko'p dona sotilgan mahsulotlar"
            >
              <FastMovingTable
                rows={movement.fastMoving}
                windowFrom={period.from}
                windowTo={period.to}
              />
            </PanelCard>

            <PanelCard
              title="Sotilmayotgan"
              description="Omborda turibdi, lekin bu davrda bitta ham sotilmadi"
            >
              <DeadStockTable
                rows={movement.deadStock}
                windowFrom={period.from}
                windowTo={period.to}
              />
            </PanelCard>
          </div>
        </section>

        {/* ── Level 3 · Xodimlar / Mijozlar ───────────────────────────────────
            On the page's recessed ground: still open by default, but the muted
            plate is what tells the eye these are supporting figures. */}
        <div className="space-y-8 rounded-lg border border-border-subtle bg-background-subtle p-4 sm:p-6">
          <section className="space-y-4">
            <SectionHeading
              level={2}
              title="Xodimlar"
              description="Yopilgan savdolar va konversiya, davr ichida"
            />

            {sellers.length === 0 ? (
              <div className="panel">
                <EmptyState
                  icon={Users}
                  title="Bu davrda faoliyat yo'q"
                  message="Tanlangan oraliqda hech bir xodim buyurtma ochmagan yoki yopmagan."
                />
              </div>
            ) : (
              <div className="grid gap-4 xl:grid-cols-3">
                <PanelCard
                  title="Daromad bo'yicha"
                  description="Yopilgan savdolar, davr ichida"
                >
                  <RankBar
                    rows={sellers.map((seller) => ({
                      id: seller.sellerId,
                      label: seller.name,
                      value: seller.revenue,
                      meta: formatInteger(seller.completedOrders) + " ta buyurtma",
                    }))}
                    emptyMessage="Bu davrda yopilgan buyurtma yo'q."
                  />
                </PanelCard>

                <PanelCard
                  title="Batafsil"
                  description="Ustun nomini bosib tartiblang"
                  className="xl:col-span-2"
                >
                  <SellerScorecardTable
                    rows={sellers}
                    windowFrom={period.from}
                    windowTo={period.to}
                  />
                </PanelCard>
              </div>
            )}
          </section>

          <section className="space-y-4">
            <SectionHeading
              level={2}
              title="Mijozlar"
              description="Birinchi xaridiga qarab — ro'yxatga olingan sanasiga emas"
            />

            {customerTotal === 0 && customers.topCustomers.length === 0 ? (
              <div className="panel">
                <EmptyState
                  icon={ShoppingCart}
                  title="Bu davrda xarid yo'q"
                  message="Tanlangan oraliqda hech bir mijoz buyurtma yopmagan."
                />
              </div>
            ) : (
              <div className="grid gap-4 xl:grid-cols-3">
                <PanelCard
                  title="Yangi va qaytgan"
                  description="Davr ichida xarid qilgan mijozlarning tarkibi"
                >
                  <DonutChart
                    totalLabel="mijoz"
                    emptyMessage="Bu davrda xarid qilgan mijoz yo'q."
                    slices={[
                      {
                        id: "returning",
                        label: "Qaytgan",
                        value: customers.returningCustomers,
                        colour: "var(--data-blue)",
                      },
                      {
                        id: "new",
                        label: "Yangi",
                        value: customers.newCustomers,
                        colour: "var(--data-green)",
                      },
                    ]}
                  />
                  {customerTotal === 0 ? null : (
                    <p className="type-caption mt-4 text-muted">
                      Jami {formatInteger(customerTotal)} ta mijoz xarid qildi.
                    </p>
                  )}
                </PanelCard>

                <PanelCard
                  title="Eng yirik mijozlar"
                  description="Davr ichidagi xarid summasi bo'yicha"
                  className="xl:col-span-2"
                >
                  <TopCustomersTable
                    rows={customers.topCustomers}
                    windowFrom={period.from}
                    windowTo={period.to}
                  />
                </PanelCard>
              </div>
            )}
          </section>
        </div>

        <AnalyticsGaps totalValue={inventory.totalValue} />
      </div>
    </div>
  );
}
