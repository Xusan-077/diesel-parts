import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/shadcn/table";
import { Badge } from "@/components/ui/shadcn/badge";
import { formatInteger } from "@/lib/analytics/format";

export interface LowStockRow {
  id: string;
  name: string;
  sku: string;
  stock: number;
  minStock: number;
}

export function LowStockTable({
  rows,
  columns,
  outOfStockLabel,
  lowStockLabel,
}: {
  rows: readonly LowStockRow[];
  columns: { product: string; stock: string; status: string };
  outOfStockLabel: string;
  lowStockLabel: string;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{columns.product}</TableHead>
          <TableHead className="text-right">{columns.stock}</TableHead>
          <TableHead className="text-right">{columns.status}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <div className="font-medium text-foreground">{row.name}</div>
              <div className="font-mono text-xs text-muted">{row.sku}</div>
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums text-foreground">
              {formatInteger(row.stock)}
              <span className="text-muted"> / {formatInteger(row.minStock)}</span>
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end">
                {row.stock === 0 ? (
                  <Badge variant="destructive">{outOfStockLabel}</Badge>
                ) : (
                  <Badge variant="warning">{lowStockLabel}</Badge>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
