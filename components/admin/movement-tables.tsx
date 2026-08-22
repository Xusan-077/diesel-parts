"use client";

import { formatCompact, formatInteger } from "@/lib/analytics/format";
import { csvFilename } from "@/lib/analytics/csv";
import type { MovementRow, ProductMovement } from "@/lib/api/analytics-detail-repository";
import { DataTable, type Column } from "@/components/admin/data-table";
import { ExportButton } from "@/components/admin/export-button";

/**
 * What sold and what sat, side by side.
 *
 * Two tables rather than one sorted list, because they answer opposite
 * questions and a director acts on them differently: the fast movers are a
 * reorder list, the dead stock is a shelf to clear. One table sorted by units
 * would put the interesting end at each extreme and bury the reason for looking
 * in the middle.
 */

const NAME_COLUMN: Column<MovementRow> = {
  key: "name",
  header: "Mahsulot",
  sortValue: (row) => row.name,
  render: (row) => (
    <>
      <span className="text-foreground">{row.name}</span>
      <span className="ml-2 font-mono text-xs text-muted">{row.sku}</span>
    </>
  ),
};

const CSV_COLUMNS = [
  { header: "SKU", value: (row: MovementRow) => row.sku },
  { header: "Nomi", value: (row: MovementRow) => row.name },
  { header: "Sotilgan (dona)", value: (row: MovementRow) => row.unitsSold },
  { header: "Daromad", value: (row: MovementRow) => Math.round(row.revenue) },
  { header: "Qoldiq", value: (row: MovementRow) => row.stock },
];

export function FastMovingTable({
  rows,
  windowFrom,
  windowTo,
}: {
  rows: readonly MovementRow[];
  windowFrom: Date;
  windowTo: Date;
}) {
  const columns: readonly Column<MovementRow>[] = [
    NAME_COLUMN,
    {
      key: "units",
      header: "Sotildi",
      numeric: true,
      sortValue: (row) => row.unitsSold,
      render: (row) => (
        <span className="text-foreground">{formatInteger(row.unitsSold)}</span>
      ),
    },
    {
      key: "revenue",
      header: "Daromad",
      numeric: true,
      sortValue: (row) => row.revenue,
      render: (row) => <span className="text-muted">{formatCompact(row.revenue)}</span>,
    },
    {
      key: "cover",
      header: "Qoldiq",
      hint: "yana shuncha davrga yetadi",
      numeric: true,
      sortValue: (row) => row.coverPeriods ?? Number.POSITIVE_INFINITY,
      render: (row) => (
        <>
          <span className="text-foreground">{formatInteger(row.stock)}</span>
          {row.coverPeriods === null ? null : (
            <span
              className={
                // Under one period of cover means this part runs out before the
                // next window closes at the current rate. That is the whole
                // reason a fast-mover table is worth reading.
                row.coverPeriods < 1 ? " text-danger" : " text-muted"
              }
            >
              {" · "}
              {row.coverPeriods < 1
                ? "yetmaydi"
                : "×" + row.coverPeriods.toFixed(1).replace(".", ",")}
            </span>
          )}
        </>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-end">
        <ExportButton
          columns={CSV_COLUMNS}
          rows={rows}
          filename={csvFilename("tez-sotiladigan", windowFrom, windowTo)}
        />
      </div>
      <div className="mt-3">
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          initialSort={{ key: "units", direction: "desc" }}
          emptyMessage="Bu davrda hech narsa sotilmagan."
        />
      </div>
    </div>
  );
}

export function DeadStockTable({
  rows,
  windowFrom,
  windowTo,
}: {
  rows: readonly MovementRow[];
  windowFrom: Date;
  windowTo: Date;
}) {
  const columns: readonly Column<MovementRow>[] = [
    NAME_COLUMN,
    {
      key: "stock",
      header: "Omborda",
      numeric: true,
      sortValue: (row) => row.stock,
      render: (row) => <span className="text-foreground">{formatInteger(row.stock)}</span>,
    },
  ];

  return (
    <div>
      <div className="flex justify-end">
        <ExportButton
          columns={CSV_COLUMNS}
          rows={rows}
          filename={csvFilename("sotilmagan", windowFrom, windowTo)}
        />
      </div>
      <div className="mt-3">
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          initialSort={{ key: "stock", direction: "desc" }}
          emptyMessage="Omborda turgan har bir mahsulot bu davrda sotilgan."
        />
      </div>
    </div>
  );
}

/** Both tables' data, for a page that wants to render them as a pair. */
export type { ProductMovement };
