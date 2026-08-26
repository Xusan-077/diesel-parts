import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/shadcn/table";
import { StockStatusBadge } from "./stock-status-badge";
import { formatInteger } from "@/lib/analytics/format";
import type { StockRow } from "@/lib/api/stock-overview-repository";

export function StockTable({ rows }: { rows: readonly StockRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Mahsulot</TableHead>
          <TableHead>SKU</TableHead>
          <TableHead>Kategoriya</TableHead>
          <TableHead className="text-right">Qoldiq</TableHead>
          <TableHead className="text-right">Holat</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-medium text-foreground">{row.name}</TableCell>
            <TableCell className="font-mono text-xs text-muted">{row.sku}</TableCell>
            <TableCell className="text-muted">{row.categoryName}</TableCell>
            <TableCell className="text-right font-mono tabular-nums text-foreground">
              {formatInteger(row.stock)}
              <span className="text-muted"> / {formatInteger(row.minStock)}</span>
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
  );
}

export function StockPager({
  page,
  totalPages,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav aria-label="Sahifalar" className="mt-6 flex items-center gap-3 text-sm">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className="text-muted hover:text-foreground">
          ← Oldingi
        </Link>
      ) : null}
      <span className="font-mono text-xs text-muted">
        {page} / {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} className="text-muted hover:text-foreground">
          Keyingi →
        </Link>
      ) : null}
    </nav>
  );
}
