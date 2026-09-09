"use client";

import Link from "next/link";
import { PackageCheck } from "lucide-react";
import { formatInteger } from "@/lib/analytics/format";
import type { CsvColumn } from "@/lib/analytics/csv";
import type { LowStockRow } from "@/lib/api/warehouse-repository";
import { EmptyState } from "@/components/director/empty-state";
import { StockStatusBadge } from "@/components/director/stock-status-badge";
import { ExportButton } from "@/components/admin/export-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/shadcn/table";

const COLUMNS: readonly CsvColumn<LowStockRow>[] = [
  { header: "SKU", value: (row) => row.sku },
  { header: "Mahsulot", value: (row) => row.name },
  { header: "Ombor", value: (row) => row.warehouseCode },
  { header: "Mavjud", value: (row) => row.available },
  { header: "Minimal", value: (row) => row.minStock },
  { header: "Tavsiya etilgan", value: (row) => row.recommendedStock },
  { header: "Yetishmaydi", value: (row) => row.shortBy },
];

export function LowStockReportView({ rows }: { rows: readonly LowStockRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={PackageCheck}
        title="Hammasi joyida"
        message="Minimal qoldiqdan pastga tushgan mahsulot yo'q."
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-xs tabular-nums text-muted">{formatInteger(rows.length)} ta pozitsiya</p>
        <ExportButton columns={COLUMNS} rows={rows} filename="kam-qolgan-mahsulotlar.csv" />
      </div>

      <div className="panel mt-3 overflow-x-auto">
        <Table className="min-w-4xl">
          <TableHeader>
            <TableRow>
              <TableHead>Mahsulot</TableHead>
              <TableHead>Ombor</TableHead>
              <TableHead className="text-right">Mavjud</TableHead>
              <TableHead className="text-right">Minimal</TableHead>
              <TableHead className="text-right">Tavsiya</TableHead>
              <TableHead className="text-right">Yetishmaydi</TableHead>
              <TableHead className="text-right">Holat</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={`${row.productId}-${row.warehouseCode}`}>
                <TableCell className="min-w-0">
                  <Link
                    href={`/director/warehouse/products/${row.productId}`}
                    className="text-foreground transition-colors hover:text-accent-strong"
                  >
                    {row.name}
                  </Link>
                  <span className="ml-2 font-mono text-xs text-muted">{row.sku}</span>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <span className="font-mono text-xs text-muted">{row.warehouseCode}</span>
                  <span className="ml-2 text-muted">{row.warehouseName}</span>
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums text-foreground">
                  {formatInteger(row.available)} {row.unit}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums text-muted">
                  {formatInteger(row.minStock)}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums text-muted">
                  {formatInteger(row.recommendedStock)}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums text-danger">
                  {row.shortBy > 0 ? `−${formatInteger(row.shortBy)}` : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end">
                    <StockStatusBadge status={row.status} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
