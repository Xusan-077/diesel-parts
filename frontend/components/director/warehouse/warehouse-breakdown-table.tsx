import { Warehouse } from "lucide-react";
import { formatInteger, formatSum } from "@/lib/analytics/format";
import type { WarehouseBreakdownRow } from "@/lib/api/warehouse-repository";
import { EmptyState } from "@/components/director/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/shadcn/table";

/** Where one product's stock actually sits — a row per warehouse holding it. */
export function WarehouseBreakdownTable({ rows }: { rows: readonly WarehouseBreakdownRow[] }) {
  if (rows.length === 0) {
    return <EmptyState icon={Warehouse} message="Bu mahsulot hech qaysi omborda yo'q." />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Ombor</TableHead>
          <TableHead className="text-right">Qoldiq</TableHead>
          <TableHead className="text-right">Zaxirada</TableHead>
          <TableHead className="text-right">Mavjud</TableHead>
          <TableHead className="text-right">O&apos;rtacha tannarx</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.warehouseId}>
            <TableCell className="whitespace-nowrap">
              <span className="font-mono text-xs text-muted">{row.warehouseCode}</span>
              <span className="ml-2 text-foreground">{row.warehouseName}</span>
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums text-foreground">
              {formatInteger(row.onHand)}
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums text-muted">
              {formatInteger(row.reserved)}
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums text-foreground">
              {formatInteger(row.available)}
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums text-muted">
              {row.unitCost === null ? "—" : formatSum(row.unitCost)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
