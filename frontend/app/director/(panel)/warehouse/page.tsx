import { Package, PackageX, TriangleAlert } from "lucide-react";
import { getStockCounts, listStock } from "@/lib/api/stock-overview-repository";
import { safeRead } from "@/lib/api/safe-read";
import type { StockStatus } from "@/lib/types";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/director/stat-card";
import { PanelCard } from "@/components/director/panel-card";
import { StatusTabs } from "@/components/director/status-tabs";
import { StockPager, StockTable } from "@/components/director/stock-table";
import { EmptyState } from "@/components/director/empty-state";
import { FilterBar, FilterField } from "@/components/director/filter-bar";

const TABS = [
  { value: "all", label: "Barchasi" },
  { value: "limited", label: "Kam qoldi" },
  { value: "out_of_stock", label: "Tugagan" },
] as const;

function isStockStatus(value: string): value is StockStatus {
  return value === "available" || value === "limited" || value === "out_of_stock";
}

export default async function DirectorWarehousePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const status = params.status && isStockStatus(params.status) ? params.status : undefined;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const [counts, stock] = await Promise.all([
    safeRead("stock counts", getStockCounts, { total: 0, available: 0, limited: 0, outOfStock: 0 }),
    safeRead(
      "stock list",
      () => listStock({ status, page }),
      { items: [], total: 0, page: 1, pageSize: 20, totalPages: 1 },
    ),
  ]);

  const hrefFor = (overrides: { status?: string; page?: number }) => {
    const next = new URLSearchParams();
    const nextStatus = overrides.status ?? status ?? "";
    if (nextStatus && nextStatus !== "all") next.set("status", nextStatus);
    const nextPage = overrides.page ?? page;
    if (nextPage > 1) next.set("page", String(nextPage));
    const query = next.toString();
    return "/director/warehouse" + (query ? "?" + query : "");
  };

  return (
    <div>
      <PageHeader
        eyebrow="Direktor paneli"
        title="Ombor"
        description="Katalogdagi qoldiqlar, bitta joylashuv bo'yicha — bo'lim omborlar kesimidagi ma'lumotlar mavjud bo'lgach kengaytiriladi."
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <StatCard label="Jami mahsulot" value={String(counts.data.total)} icon={Package} />
        <StatCard label="Kam qoldi" value={String(counts.data.limited)} icon={TriangleAlert} />
        <StatCard label="Tugagan" value={String(counts.data.outOfStock)} icon={PackageX} />
      </div>

      <div className="mt-8">
        <FilterBar>
          <FilterField label="Holat bo'yicha filtr">
            <StatusTabs
              value={status ?? "all"}
              options={TABS.map((tab) => ({
                ...tab,
                href: hrefFor({ status: tab.value, page: 1 }),
              }))}
            />
          </FilterField>
        </FilterBar>
      </div>

      <div className="mt-4">
        <PanelCard title="Qoldiqlar" description="Eng kam qolgan mahsulotlar tepada.">
          {stock.data.items.length === 0 ? (
            <EmptyState icon={Package} message="Hech narsa topilmadi." />
          ) : (
            <>
              <StockTable rows={stock.data.items} />
              <StockPager
                page={stock.data.page}
                totalPages={stock.data.totalPages}
                hrefFor={(next) => hrefFor({ page: next })}
              />
            </>
          )}
        </PanelCard>
      </div>
    </div>
  );
}
