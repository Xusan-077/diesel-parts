"use client";

import { useState } from "react";
import { AlertTriangle, PackageX, Warehouse } from "lucide-react";
import { formatCompact, formatInteger } from "@/lib/analytics/format";
import { csvFilename } from "@/lib/analytics/csv";
import type { InventorySummary, StockRow } from "@/lib/api/analytics-detail-repository";
import { FormModalShell } from "@/components/ui/form-modal-shell";
import { Icon } from "@/components/ui/icon";
import { DataTable, type Column } from "@/components/admin/data-table";
import { ExportButton } from "@/components/admin/export-button";
import { cn } from "@/lib/utils";

/**
 * What is on the shelf, and the two lists a director actually acts on.
 *
 * The three figures are buttons. A stat that reports "38 tugagan" and cannot be
 * opened makes the reader go to the catalogue, search, filter, and rebuild the
 * list the dashboard had already computed — so each one opens the rows behind
 * it, in a drawer over this screen.
 *
 * Only the two shortage tiles open. The total value has no list behind it that
 * is worth reading: it is every active product in the catalogue, which is the
 * catalogue page.
 */

/** Which list the drawer is showing. `null` is closed. */
type Drawer = "low" | "out" | null;

const STOCK_COLUMNS: readonly Column<StockRow>[] = [
  {
    key: "name",
    header: "Mahsulot",
    sortValue: (row) => row.name,
    render: (row) => (
      <>
        <span className="text-foreground">{row.name}</span>
        <span className="ml-2 font-mono text-xs text-muted">{row.sku}</span>
      </>
    ),
  },
  {
    key: "category",
    header: "Kategoriya",
    sortValue: (row) => row.categoryName,
    render: (row) => <span className="text-muted">{row.categoryName}</span>,
  },
  {
    key: "stock",
    header: "Qoldiq",
    numeric: true,
    sortValue: (row) => row.stock,
    render: (row) => (
      <>
        <span className={row.stock === 0 ? "text-danger" : "text-warning"}>
          {formatInteger(row.stock)}
        </span>
        <span className="text-muted"> / {formatInteger(row.minStock)}</span>
      </>
    ),
  },
  {
    key: "value",
    header: "Qiymati",
    numeric: true,
    sortValue: (row) => row.value,
    render: (row) =>
      row.price === null ? (
        <span className="text-muted">so&apos;rov bo&apos;yicha</span>
      ) : (
        <span className="text-foreground">{formatCompact(row.value)}</span>
      ),
  },
];

const CSV_COLUMNS = [
  { header: "SKU", value: (row: StockRow) => row.sku },
  { header: "Nomi", value: (row: StockRow) => row.name },
  { header: "Kategoriya", value: (row: StockRow) => row.categoryName },
  { header: "Qoldiq", value: (row: StockRow) => row.stock },
  { header: "Minimal qoldiq", value: (row: StockRow) => row.minStock },
  { header: "Narx", value: (row: StockRow) => row.price },
  { header: "Qiymati", value: (row: StockRow) => Math.round(row.value) },
];

function StockStat({
  label,
  value,
  unit,
  hint,
  icon,
  tone = "neutral",
  onOpen,
  openLabel,
}: {
  label: string;
  value: string;
  unit?: string;
  hint: string;
  icon: React.ComponentProps<typeof Icon>["icon"];
  tone?: "neutral" | "warning" | "danger";
  onOpen?: () => void;
  openLabel?: string;
}) {
  const body = (
    <>
      <span
        className={cn(
          "flex size-9 items-center justify-center rounded-full",
          tone === "danger"
            ? "bg-danger-surface text-danger"
            : tone === "warning"
              ? "bg-warning-surface text-warning"
              : "bg-accent-subtle text-accent-strong",
        )}
      >
        <Icon icon={icon} size="md" />
      </span>

      <span className="mt-4 block font-mono text-2xl font-semibold tabular-nums text-foreground">
        {value}
        {unit === undefined ? null : (
          <span className="ml-1 text-sm font-normal text-muted">{unit}</span>
        )}
      </span>
      <span className="mt-1 block text-sm text-foreground">{label}</span>
      <span className="mt-1 block text-xs text-muted">{hint}</span>
    </>
  );

  if (onOpen === undefined) {
    return <div className="panel">{body}</div>;
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="panel text-left transition-colors hover:bg-surface-hover"
    >
      {body}
      <span className="mt-3 block text-xs text-accent-strong">{openLabel} →</span>
    </button>
  );
}

export function InventoryPanel({
  summary,
  windowFrom,
  windowTo,
}: {
  summary: InventorySummary;
  windowFrom: Date;
  windowTo: Date;
}) {
  const [drawer, setDrawer] = useState<Drawer>(null);

  const rows = drawer === "out" ? summary.outOfStock : summary.lowStock;
  const title = drawer === "out" ? "Tugagan mahsulotlar" : "Kam qolgan mahsulotlar";

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <StockStat
          label="Ombor qiymati"
          value={formatCompact(summary.totalValue)}
          unit="so'm"
          /* Says which price this is valued at. There is no purchase price in
             the schema, so this is a retail figure — labelling it "ombor
             qiymati" alone is how it ends up quoted as an asset value. */
          hint={
            summary.unpricedProducts === 0
              ? "Katalog narxida, " + formatInteger(summary.activeProducts) + " ta mahsulot"
              : "Katalog narxida · " +
                formatInteger(summary.unpricedProducts) +
                " ta narxsiz mahsulot hisobga olinmadi"
          }
          icon={Warehouse}
        />
        <StockStat
          label="Kam qoldi"
          value={formatInteger(summary.lowStock.length)}
          unit="ta"
          hint="Minimal chegarada yoki undan past"
          icon={AlertTriangle}
          tone="warning"
          onOpen={summary.lowStock.length === 0 ? undefined : () => setDrawer("low")}
          openLabel="Ro'yxatni ochish"
        />
        <StockStat
          label="Tugagan"
          value={formatInteger(summary.outOfStock.length)}
          unit="ta"
          hint="Omborda qolmagan, saytda hali ko'rinadi"
          icon={PackageX}
          tone="danger"
          onOpen={summary.outOfStock.length === 0 ? undefined : () => setDrawer("out")}
          openLabel="Ro'yxatni ochish"
        />
      </div>

      <FormModalShell
        open={drawer !== null}
        onOpenChange={() => setDrawer(null)}
        title={title}
        description={formatInteger(rows.length) + " ta mahsulot · eng kam qolgani birinchi"}
        closeLabel="Yopish"
        size="xl"
        footer={
          <ExportButton
            columns={CSV_COLUMNS}
            rows={rows}
            filename={csvFilename(
              drawer === "out" ? "tugagan" : "kam-qolgan",
              windowFrom,
              windowTo,
            )}
            label="CSV yuklab olish"
          />
        }
      >
        <DataTable
          columns={STOCK_COLUMNS}
          rows={rows}
          rowKey={(row) => row.id}
          initialSort={{ key: "stock", direction: "asc" }}
          emptyMessage="Ro'yxat bo'sh."
        />

        {/* The valuation caveat travels with the numbers rather than living
            only on the tile that opened the drawer. */}
        <p className="mt-4 text-xs text-muted">
          Qiymat katalog narxida hisoblangan — tannarx tizimda saqlanmaydi.
        </p>
      </FormModalShell>
    </>
  );
}
