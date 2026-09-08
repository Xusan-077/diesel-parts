import Link from "next/link";
import { Boxes, PackageX, Plus, TriangleAlert, Warehouse } from "lucide-react";
import { getWarehouseDashboard } from "@/lib/api/warehouse-repository";
import { safeRead } from "@/lib/api/safe-read";
import { formatInteger, formatSum } from "@/lib/analytics/format";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/director/stat-card";
import { PanelCard, SeeAllLink } from "@/components/director/panel-card";
import { NumberTicker } from "@/components/director/number-ticker";
import { Button } from "@/components/ui/shadcn/button";
import { MovementsTable } from "@/components/director/warehouse/movements-table";
import { LowStockPanel } from "@/components/director/warehouse/low-stock-panel";

const EMPTY = {
  productCount: 0,
  totalOnHand: 0,
  totalReserved: 0,
  stockValue: 0,
  lowStockCount: 0,
  outOfStockCount: 0,
  warehouseCount: 0,
  lowStock: [],
  recentMovements: [],
};

export default async function WarehouseDashboardPage() {
  const dashboard = await safeRead("warehouse dashboard", getWarehouseDashboard, EMPTY);
  const d = dashboard.data;

  return (
    <div>
      <PageHeader
        eyebrow="Direktor paneli"
        title="Ombor"
        description="Qoldiqlar, harakatlar va qabullar — barcha omborlar kesimida."
        actions={
          <Button asChild>
            <Link href="/director/warehouse/incomes/new">
              <Plus className="size-4" aria-hidden="true" />
              Yangi qabul
            </Link>
          </Button>
        }
      />

      {!dashboard.ok ? (
        <p className="mt-6 rounded-lg border border-border bg-warning-surface px-4 py-3 text-sm text-foreground">
          Ombor ma&apos;lumotlarini hozircha yuklab bo&apos;lmadi. Sahifani yangilab ko&apos;ring.
        </p>
      ) : null}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Mahsulotlar"
          value={<NumberTicker value={d.productCount} format={formatInteger} />}
          icon={Boxes}
          tone="orders"
          hint={`${formatInteger(d.warehouseCount)} ta ombor`}
        />
        <StatCard
          label="Umumiy qoldiq"
          value={<NumberTicker value={d.totalOnHand} format={formatInteger} />}
          unit="dona"
          icon={Warehouse}
          tone="revenue"
          hint={`${formatInteger(d.totalReserved)} dona zaxirada · ${formatSum(d.stockValue)}`}
        />
        <StatCard
          label="Kam qolgan"
          value={<NumberTicker value={d.lowStockCount} format={formatInteger} />}
          icon={TriangleAlert}
          tone={d.lowStockCount > 0 ? "warning" : "neutral"}
          hint="Minimal qoldiqdan pastda"
        />
        <StatCard
          label="Tugagan"
          value={<NumberTicker value={d.outOfStockCount} format={formatInteger} />}
          icon={PackageX}
          tone={d.outOfStockCount > 0 ? "danger" : "neutral"}
          hint="Qoldiq nolga tushgan"
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <PanelCard
            title="So'nggi harakatlar"
            description="Omborlar bo'yicha eng yangi kirim-chiqim yozuvlari."
            action={<SeeAllLink href="/director/warehouse/reports/movements" label="Hammasi" />}
            bodyClassName="overflow-x-auto"
          >
            <MovementsTable rows={d.recentMovements} />
          </PanelCard>
        </div>

        <div className="lg:col-span-2">
          <PanelCard
            title="To'ldirish kerak"
            description="Minimal qoldiqqa yetgan yoki undan past mahsulotlar."
            action={<SeeAllLink href="/director/warehouse/reports/low-stock" label="Hammasi" />}
          >
            <LowStockPanel rows={d.lowStock} />
          </PanelCard>
        </div>
      </div>
    </div>
  );
}
