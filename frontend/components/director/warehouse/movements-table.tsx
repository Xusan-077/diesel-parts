import Link from "next/link";
import { PackageSearch } from "lucide-react";
import { formatInteger, formatSum } from "@/lib/analytics/format";
import { formatDateTime } from "@/lib/warehouse/format";
import type { MovementRow } from "@/lib/api/warehouse-repository";
import { EmptyState } from "@/components/director/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/shadcn/table";
import { MovementTypeBadge, signedQuantity } from "./movement-type-badge";

/**
 * The stock ledger, one shape for the three places it appears: the dashboard's
 * recent-activity card, a product's own history, and the movements report.
 *
 * `showProduct` adds the product column — on when the rows span the catalog
 * (report, dashboard), off on a single product's page where every row is the
 * same part. The header sticks when the table is the page's main scroll
 * region, which the reports page opts into.
 */
export function MovementsTable({
  rows,
  showProduct = true,
  stickyHeader = false,
}: {
  rows: readonly MovementRow[];
  showProduct?: boolean;
  stickyHeader?: boolean;
}) {
  if (rows.length === 0) {
    return <EmptyState icon={PackageSearch} message="Harakatlar topilmadi." />;
  }

  const headClass = stickyHeader
    ? "sticky top-0 z-10 bg-surface"
    : undefined;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className={headClass}>Sana</TableHead>
          <TableHead className={headClass}>Turi</TableHead>
          {showProduct ? <TableHead className={headClass}>Mahsulot</TableHead> : null}
          <TableHead className={headClass}>Ombor</TableHead>
          <TableHead className={`text-right ${headClass ?? ""}`}>Miqdor</TableHead>
          <TableHead className={`text-right ${headClass ?? ""}`}>Qoldiq</TableHead>
          <TableHead className={`text-right ${headClass ?? ""}`}>Tannarx</TableHead>
          <TableHead className={headClass}>Kim</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const qty = signedQuantity(row.type, row.quantity);
          return (
            <TableRow key={row.id}>
              <TableCell className="whitespace-nowrap text-muted">
                {formatDateTime(row.createdAt)}
              </TableCell>
              <TableCell>
                <MovementTypeBadge type={row.type} />
              </TableCell>
              {showProduct ? (
                <TableCell className="min-w-0">
                  {row.productId ? (
                    <Link
                      href={`/director/warehouse/products/${row.productId}`}
                      className="text-foreground transition-colors hover:text-accent-strong"
                    >
                      {row.productName}
                    </Link>
                  ) : (
                    <span className="text-foreground">{row.productName ?? "—"}</span>
                  )}
                  {row.productSku ? (
                    <span className="ml-2 font-mono text-xs text-muted">{row.productSku}</span>
                  ) : null}
                </TableCell>
              ) : null}
              <TableCell className="whitespace-nowrap">
                <span className="font-mono text-xs text-muted">{row.warehouseCode}</span>
                <span className="ml-2 text-muted">{row.warehouseName}</span>
              </TableCell>
              <TableCell
                className={
                  "text-right font-mono tabular-nums " +
                  (qty.tone === "out" ? "text-danger" : "text-success")
                }
              >
                {qty.text}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums text-foreground">
                {formatInteger(row.balanceAfter)}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums text-muted">
                {row.unitCost === null ? "—" : formatSum(row.unitCost)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted">{row.actorName ?? "—"}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
