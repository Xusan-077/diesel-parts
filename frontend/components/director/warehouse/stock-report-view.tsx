"use client";

import { Warehouse } from "lucide-react";
import { formatInteger, formatSum } from "@/lib/analytics/format";
import type { CsvColumn } from "@/lib/analytics/csv";
import type { StockReport, StockReportRow } from "@/lib/api/warehouse-repository";
import { EmptyState } from "@/components/director/empty-state";
import { ExportButton } from "@/components/admin/export-button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/shadcn/table";

const COLUMNS: readonly CsvColumn<StockReportRow>[] = [
  { header: "Kod", value: (row) => row.warehouseCode },
  { header: "Ombor", value: (row) => row.warehouseName },
  { header: "SKU soni", value: (row) => row.skuCount },
  { header: "Qoldiq", value: (row) => row.onHand },
  { header: "Zaxirada", value: (row) => row.reserved },
  { header: "Qiymat", value: (row) => Math.round(row.stockValue) },
];

export function StockReportView({ report }: { report: StockReport }) {
  if (report.rows.length === 0) {
    return <EmptyState icon={Warehouse} message="Hech qaysi omborda qoldiq yo'q." />;
  }

  return (
    <div>
      <div className="flex justify-end">
        <ExportButton columns={COLUMNS} rows={report.rows} filename="ombor-qoldiqlari.csv" />
      </div>

      <div className="panel mt-3 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kod</TableHead>
              <TableHead>Ombor</TableHead>
              <TableHead className="text-right">SKU soni</TableHead>
              <TableHead className="text-right">Qoldiq</TableHead>
              <TableHead className="text-right">Zaxirada</TableHead>
              <TableHead className="text-right">Qiymat</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.rows.map((row) => (
              <TableRow key={row.warehouseId}>
                <TableCell className="font-mono text-xs text-muted">{row.warehouseCode}</TableCell>
                <TableCell className="text-foreground">{row.warehouseName}</TableCell>
                <TableCell className="text-right font-mono tabular-nums text-muted">
                  {formatInteger(row.skuCount)}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums text-foreground">
                  {formatInteger(row.onHand)}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums text-muted">
                  {formatInteger(row.reserved)}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums text-foreground">
                  {formatSum(row.stockValue)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={2} className="text-foreground">
                Jami
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums text-foreground">
                {formatInteger(report.totals.skuCount)}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums text-foreground">
                {formatInteger(report.totals.onHand)}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums text-foreground">
                {formatInteger(report.totals.reserved)}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums text-foreground">
                {formatSum(report.totals.stockValue)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  );
}
