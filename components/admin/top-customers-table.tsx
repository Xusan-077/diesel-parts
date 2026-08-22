"use client";

import { formatCompact, formatInteger } from "@/lib/analytics/format";
import { csvFilename } from "@/lib/analytics/csv";
import type { TopCustomer } from "@/lib/api/analytics-detail-repository";
import { DataTable, type Column } from "@/components/admin/data-table";
import { ExportButton } from "@/components/admin/export-button";

const CSV_COLUMNS = [
  { header: "Mijoz", value: (row: TopCustomer) => row.name },
  { header: "Kompaniya", value: (row: TopCustomer) => row.company },
  { header: "Buyurtmalar", value: (row: TopCustomer) => row.orders },
  { header: "Xarid summasi", value: (row: TopCustomer) => Math.round(row.revenue) },
];

/**
 * Who spent the most in the window.
 *
 * The rank is printed rather than left to row order, because the table is
 * sortable: once a director sorts by order count, "third row" and "third
 * biggest customer" stop being the same thing, and the number is what keeps the
 * ranking readable after the sort has moved.
 */
export function TopCustomersTable({
  rows,
  windowFrom,
  windowTo,
}: {
  rows: readonly TopCustomer[];
  windowFrom: Date;
  windowTo: Date;
}) {
  const rankById = new Map(rows.map((row, index) => [row.id, index + 1] as const));

  const columns: readonly Column<TopCustomer>[] = [
    {
      key: "rank",
      header: "#",
      render: (row) => (
        <span className="font-mono text-xs tabular-nums text-muted">
          {rankById.get(row.id)}
        </span>
      ),
    },
    {
      key: "name",
      header: "Mijoz",
      sortValue: (row) => row.name,
      render: (row) => (
        <>
          <span className="text-foreground">{row.name}</span>
          {row.company === null ? null : (
            <span className="ml-2 text-xs text-muted">{row.company}</span>
          )}
        </>
      ),
    },
    {
      key: "orders",
      header: "Buyurtmalar",
      numeric: true,
      sortValue: (row) => row.orders,
      render: (row) => <span className="text-muted">{formatInteger(row.orders)}</span>,
    },
    {
      key: "revenue",
      header: "Xarid summasi",
      numeric: true,
      sortValue: (row) => row.revenue,
      render: (row) => <span className="text-foreground">{formatCompact(row.revenue)}</span>,
    },
  ];

  return (
    <div>
      <div className="flex justify-end">
        <ExportButton
          columns={CSV_COLUMNS}
          rows={rows}
          filename={csvFilename("top-mijozlar", windowFrom, windowTo)}
        />
      </div>
      <div className="mt-3">
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          initialSort={{ key: "revenue", direction: "desc" }}
          emptyMessage="Bu davrda yopilgan buyurtma yo'q."
        />
      </div>
    </div>
  );
}
