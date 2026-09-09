import Link from "next/link";
import { PackageCheck } from "lucide-react";
import { formatInteger } from "@/lib/analytics/format";
import type { LowStockRow } from "@/lib/api/warehouse-repository";
import { EmptyState } from "@/components/director/empty-state";
import { StockStatusBadge } from "@/components/director/stock-status-badge";

/**
 * The "restock these" list, compact enough for the dashboard's side card: the
 * part, where it is short, and by how much. Worst first (the report already
 * sorts it that way). The full, filterable version is the low-stock report.
 */
export function LowStockPanel({ rows }: { rows: readonly LowStockRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={PackageCheck}
        message="Hamma narsa yetarli — minimal qoldiqdan pastga tushgan mahsulot yo'q."
      />
    );
  }

  return (
    <ul className="divide-y divide-border">
      {rows.map((row) => (
        <li
          key={`${row.productId}-${row.warehouseCode}`}
          className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
        >
          <div className="min-w-0">
            <Link
              href={`/director/warehouse/products/${row.productId}`}
              className="block truncate text-sm text-foreground transition-colors hover:text-accent-strong"
            >
              {row.name}
            </Link>
            <p className="mt-0.5 flex items-center gap-2 text-xs text-muted">
              <span className="font-mono">{row.sku}</span>
              <span aria-hidden="true">·</span>
              <span>{row.warehouseCode}</span>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3 text-right">
            <div className="font-mono text-xs tabular-nums">
              <span className="text-foreground">{formatInteger(row.available)}</span>
              <span className="text-muted"> / {formatInteger(row.minStock)}</span>
              {row.shortBy > 0 ? (
                <span className="block text-danger">−{formatInteger(row.shortBy)}</span>
              ) : null}
            </div>
            <StockStatusBadge status={row.status} />
          </div>
        </li>
      ))}
    </ul>
  );
}
