"use client";

import { formatCompact, formatInteger } from "@/lib/analytics/format";
import { csvFilename } from "@/lib/analytics/csv";
import type { SellerScorecard } from "@/lib/api/analytics-detail-repository";
import { DataTable, type Column } from "@/components/admin/data-table";
import { ExportButton } from "@/components/admin/export-button";
import { cn } from "@/lib/utils";

/**
 * A percentage, with the bar behind it.
 *
 * The bar is not decoration: a column of "12,5%" and "48,0%" is read as text
 * and compared by arithmetic, and the same column with a bar behind it is
 * compared by length at a glance. It is drawn as a background on the cell's own
 * content rather than as a separate element so it cannot fall out of alignment
 * with the figure it describes.
 */
function Rate({ value, tone }: { value: number; tone: "good" | "bad" }) {
  return (
    <span className="relative inline-flex w-20 justify-end">
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0.5 right-0 rounded-xs",
          tone === "good" ? "bg-success/18" : "bg-danger/18",
        )}
        style={{ width: Math.min(100, Math.max(0, value)) + "%" }}
      />
      <span className="relative">{value.toFixed(1).replace(".", ",")}%</span>
    </span>
  );
}

const CSV_COLUMNS = [
  { header: "Xodim", value: (row: SellerScorecard) => row.name },
  { header: "Daromad", value: (row: SellerScorecard) => Math.round(row.revenue) },
  { header: "Yopilgan buyurtmalar", value: (row: SellerScorecard) => row.completedOrders },
  { header: "Jami buyurtmalar", value: (row: SellerScorecard) => row.totalOrders },
  { header: "Bekor qilingan", value: (row: SellerScorecard) => row.cancelledOrders },
  {
    header: "Bekor qilish ulushi %",
    value: (row: SellerScorecard) => Number(row.cancelledRate.toFixed(2)),
  },
  { header: "O'rtacha chek", value: (row: SellerScorecard) => Math.round(row.averageOrderValue) },
  { header: "Biriktirilgan so'rovlar", value: (row: SellerScorecard) => row.inquiries },
  {
    header: "Konversiya %",
    value: (row: SellerScorecard) => Number(row.conversionRate.toFixed(2)),
  },
];

export function SellerScorecardTable({
  rows,
  windowFrom,
  windowTo,
}: {
  rows: readonly SellerScorecard[];
  windowFrom: Date;
  windowTo: Date;
}) {
  const columns: readonly Column<SellerScorecard>[] = [
    {
      key: "name",
      header: "Xodim",
      sortValue: (row) => row.name,
      render: (row) => <span className="text-foreground">{row.name}</span>,
    },
    {
      key: "revenue",
      header: "Daromad",
      numeric: true,
      sortValue: (row) => row.revenue,
      render: (row) => <span className="text-foreground">{formatCompact(row.revenue)}</span>,
    },
    {
      key: "orders",
      header: "Yopilgan",
      hint: "jamidan",
      numeric: true,
      sortValue: (row) => row.completedOrders,
      render: (row) => (
        <>
          <span className="text-foreground">{formatInteger(row.completedOrders)}</span>
          <span className="text-muted"> / {formatInteger(row.totalOrders)}</span>
        </>
      ),
    },
    {
      key: "average",
      header: "O'rtacha chek",
      numeric: true,
      sortValue: (row) => row.averageOrderValue,
      render: (row) => (
        <span className="text-foreground">{formatCompact(row.averageOrderValue)}</span>
      ),
    },
    {
      key: "conversion",
      header: "Konversiya",
      hint: "so'rovdan buyurtmaga",
      numeric: true,
      sortValue: (row) => row.conversionRate,
      render: (row) =>
        row.inquiries === 0 ? (
          // Not "0%": nothing was assigned, so there was nothing to convert,
          // and a zero here would read as a seller who lost every enquiry.
          <span className="text-muted">so&apos;rov yo&apos;q</span>
        ) : (
          <Rate value={row.conversionRate} tone="good" />
        ),
    },
    {
      key: "cancelled",
      header: "Bekor qilingan",
      numeric: true,
      sortValue: (row) => row.cancelledRate,
      render: (row) =>
        row.totalOrders === 0 ? (
          <span className="text-muted">—</span>
        ) : (
          <Rate value={row.cancelledRate} tone="bad" />
        ),
    },
  ];

  /*
   * Only the extremes are marked, and only when there is a spread to mark. With
   * two sellers every row would be either best or worst, which tells the reader
   * nothing they could not see by looking at two rows.
   */
  const revenues = rows.map((row) => row.revenue);
  const best = Math.max(...revenues);
  const worst = Math.min(...revenues);
  const spread = rows.length > 2 && best !== worst;

  return (
    <div>
      <div className="flex justify-end">
        <ExportButton
          columns={CSV_COLUMNS}
          rows={rows}
          filename={csvFilename("xodimlar", windowFrom, windowTo)}
        />
      </div>

      <div className="mt-3">
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.sellerId}
          initialSort={{ key: "revenue", direction: "desc" }}
          emptyMessage="Bu davrda hech kim buyurtma ochmagan."
          highlight={
            spread
              ? (row) =>
                  row.revenue === best ? "positive" : row.revenue === worst ? "negative" : null
              : undefined
          }
        />
      </div>
    </div>
  );
}
