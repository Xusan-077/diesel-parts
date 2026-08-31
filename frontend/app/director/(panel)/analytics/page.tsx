import { Info } from "lucide-react";
import {
  getCustomerAnalytics,
  getInventorySummary,
  getProductMovement,
  getSalesSeries,
  getSellerScorecards,
} from "@/lib/api/analytics-detail-repository";
import { resolvePeriod } from "@/lib/analytics/period";
import { formatCompact, formatInteger } from "@/lib/analytics/format";
import { csvFilename } from "@/lib/analytics/csv";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/admin/page-header";
import { PanelSection } from "@/components/admin/panel-section";
import { AnalyticsPeriod } from "@/components/admin/analytics-period";
import { DonutChart } from "@/components/admin/donut-chart";
import { InventoryPanel } from "@/components/admin/inventory-panel";
import { DeadStockTable, FastMovingTable } from "@/components/admin/movement-tables";
import { RankBar } from "@/components/admin/rank-bar";
import { SalesChart } from "@/components/admin/sales-chart";
import { SellerScorecardTable } from "@/components/admin/seller-scorecard-table";
import { TopCustomersTable } from "@/components/admin/top-customers-table";

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

      {/* One rhythm for the whole page: 32px between blocks, cards carrying
          their own 24px inside. Same as the dashboard, deliberately. */}
      <div className="mt-8 space-y-8">
        <PanelSection
          title="Savdo"
          description="Ko'rsatkichni tanlang — grafik o'sha o'lchovga o'tadi. Uzuq chiziq — oldingi davr."
        >
          <SalesChart
            series={sales}
            periodLabel={windowLabel}
            previousLabel="Oldingi davr"
            filename={csvFilename("savdo", period.from, period.to)}
          />
        </PanelSection>

        <section className="space-y-4">
          <h2 className="type-title text-foreground">Ombor</h2>
          <InventoryPanel
            summary={inventory}
            windowFrom={period.from}
            windowTo={period.to}
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <PanelSection
              title="Tez sotiladigan"
              description="Davr ichida eng ko'p dona sotilgan mahsulotlar"
              meta={inventory.lowStock.length > 0 ? undefined : undefined}
            >
              <FastMovingTable
                rows={movement.fastMoving}
                windowFrom={period.from}
                windowTo={period.to}
              />
            </PanelSection>

            <PanelSection
              title="Sotilmayotgan"
              description="Omborda turibdi, lekin bu davrda bitta ham sotilmadi"
            >
              <DeadStockTable
                rows={movement.deadStock}
                windowFrom={period.from}
                windowTo={period.to}
              />
            </PanelSection>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="type-title text-foreground">Xodimlar</h2>

          <div className="grid gap-4 xl:grid-cols-3">
            <PanelSection
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
            </PanelSection>

            <PanelSection
              title="Batafsil"
              description="Ustun nomini bosib tartiblang"
              className="xl:col-span-2"
            >
              <SellerScorecardTable
                rows={sellers}
                windowFrom={period.from}
                windowTo={period.to}
              />
            </PanelSection>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="type-title text-foreground">Mijozlar</h2>

          <div className="grid gap-4 xl:grid-cols-3">
            <PanelSection
              title="Yangi va qaytgan"
              description="Birinchi xaridiga qarab, ro'yxatga olingan sanasiga emas"
            >
              <DonutChart
                totalLabel="mijoz"
                emptyMessage="Bu davrda xarid qilgan mijoz yo'q."
                slices={[
                  {
                    id: "returning",
                    label: "Qaytgan",
                    value: customers.returningCustomers,
                    colour: "var(--chart-series)",
                  },
                  {
                    id: "new",
                    label: "Yangi",
                    value: customers.newCustomers,
                    colour: "var(--success)",
                  },
                ]}
              />
              {customerTotal === 0 ? null : (
                <p className="mt-4 text-xs text-muted">
                  Jami {formatInteger(customerTotal)} ta mijoz xarid qildi.
                </p>
              )}
            </PanelSection>

            <PanelSection
              title="Eng yirik mijozlar"
              description="Davr ichidagi xarid summasi bo'yicha"
              className="xl:col-span-2"
            >
              <TopCustomersTable
                rows={customers.topCustomers}
                windowFrom={period.from}
                windowTo={period.to}
              />
            </PanelSection>
          </div>
        </section>

        {/*
          * The honest footer.
          *
          * Four sections were asked for that this screen does not draw, and
          * saying so here is the difference between a panel that is incomplete
          * and one that looks finished while quietly omitting the margin a
          * director came to check. Each line names what is missing and what it
          * needs — the same list, in more detail, sits at the foot of
          * `analytics-detail-repository.ts`.
          */}
        <aside className="panel">
          <div className="flex items-start gap-3">
            <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-muted">
              <Icon icon={Info} size="md" />
            </span>
            <div className="min-w-0">
              <h2 className="type-title text-foreground">Hozircha hisoblab bo&apos;lmaydi</h2>
              <p className="mt-1 type-caption text-muted">
                Quyidagilar uchun bazada ma&apos;lumot yo&apos;q — so&apos;rov emas, ustun
                yetishmaydi.
              </p>

              <ul className="mt-4 space-y-3 text-sm">
                <li className="border-l-2 border-border pl-3">
                  <span className="text-foreground">Mahsulot rentabelligi (margin %)</span>
                  <span className="mt-1 block text-xs text-muted">
                    Kerak: <span className="font-mono">Product.purchasePrice</span> va sotuv
                    paytidagi tannarx uchun <span className="font-mono">OrderItem.unitCost</span>.
                  </span>
                </li>
                <li className="border-l-2 border-border pl-3">
                  <span className="text-foreground">Yetkazib beruvchilar tahlili</span>
                  <span className="mt-1 block text-xs text-muted">
                    Kerak: <span className="font-mono">Supplier</span> modeli,{" "}
                    <span className="font-mono">Product.supplierId</span> va narx tarixi uchun{" "}
                    <span className="font-mono">SupplierPrice</span>.
                  </span>
                </li>
                <li className="border-l-2 border-border pl-3">
                  <span className="text-foreground">Qarzdorlik trendi</span>
                  <span className="mt-1 block text-xs text-muted">
                    Kerak: to&apos;lovlar hisobi —{" "}
                    <span className="font-mono">Payment&#123; orderId, amount, paidAt &#125;</span>.
                    Hozir har bir yopilgan buyurtma to&apos;liq to&apos;langan deb hisoblanadi.
                  </span>
                </li>
                <li className="border-l-2 border-border pl-3">
                  <span className="text-foreground">Ombor qiymati trendi</span>
                  <span className="mt-1 block text-xs text-muted">
                    Kerak: davriy snapshot —{" "}
                    <span className="font-mono">InventorySnapshot&#123; takenAt, totalValue &#125;</span>.
                    Tarixni keyin tiklab bo&apos;lmaydi, yozib borish kerak.
                  </span>
                </li>
              </ul>

              <p className="mt-4 text-xs text-muted">
                Ombor qiymati katalog narxida hisoblangan:{" "}
                <span className="font-mono tabular-nums">
                  {formatCompact(inventory.totalValue)} so&apos;m
                </span>
                . Tannarx saqlanmagani uchun bu chakana baho, aktiv qiymati emas.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
