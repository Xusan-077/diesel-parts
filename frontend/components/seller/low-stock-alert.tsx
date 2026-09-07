"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { useLowStock } from "@/hooks/seller/queries/use-low-stock";
import { Badge } from "@/components/seller/ui/badge";
import { STOCK_STATUS_LABEL, STOCK_STATUS_TONE } from "@/lib/seller/stock-status-labels";

export function LowStockAlert() {
  const { data, isLoading, isError } = useLowStock();

  if (isLoading || isError || !data || data.data.length === 0) {
    return null;
  }

  const rows = data.data.slice(0, 5);

  return (
    <div className="rounded-lg border border-warning/50 bg-warning-surface p-6">
      <div className="mb-4 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-warning" />
        <p className="type-title text-foreground">Kam qolgan mahsulotlar</p>
      </div>
      <ul className="flex flex-col gap-2.5">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-3 text-sm">
            <Link
              href={`/seller/products/${row.productId}`}
              className="min-w-0 truncate text-foreground hover:text-accent-strong"
            >
              {row.product.name}
            </Link>
            <div className="flex shrink-0 items-center gap-2">
              <span className="font-mono text-xs text-muted">{row.availableQuantity} ta</span>
              <Badge tone={STOCK_STATUS_TONE[row.status]}>{STOCK_STATUS_LABEL[row.status]}</Badge>
            </div>
          </li>
        ))}
      </ul>
      {data.data.length > rows.length ? (
        <Link
          href="/seller/inventory"
          className="type-label mt-4 inline-block text-accent-strong hover:underline"
        >
          Barchasini ko&apos;rish ({data.data.length})
        </Link>
      ) : null}
    </div>
  );
}
