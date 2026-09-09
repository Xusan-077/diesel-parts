"use client";

import { useParams } from "next/navigation";
import { useProduct, useProductStock } from "@/hooks/seller/queries/use-product";
import { QueryErrorState } from "@/components/seller/query-error-state";
import { Badge } from "@/components/seller/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/seller/ui/table";
import { formatMoney } from "@/lib/seller/format";
import { STOCK_STATUS_LABEL, STOCK_STATUS_TONE } from "@/lib/seller/stock-status-labels";

export default function SellerProductDetailPage() {
  const params = useParams<{ id: string }>();
  const product = useProduct(params.id);
  const stock = useProductStock(params.id);

  if (product.isError) {
    return <QueryErrorState error={product.error} onRetry={() => product.refetch()} />;
  }

  if (product.isLoading || !product.data) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-8 w-64 animate-pulse rounded-sm bg-surface-muted" />
        <div className="h-40 animate-pulse rounded-lg bg-surface-muted" />
      </div>
    );
  }

  const p = product.data;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-6">
        <div>
          <p className="type-eyebrow flex items-center gap-2 font-mono text-muted">
            <span aria-hidden="true" className="h-3 w-0.5 shrink-0 bg-accent-strong" />
            {p.sku}
          </p>
          <h1 className="type-page mt-1 text-foreground">{p.name}</h1>
        </div>
        <Badge tone={STOCK_STATUS_TONE[p.stockStatus]}>{STOCK_STATUS_LABEL[p.stockStatus]}</Badge>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="panel">
          <p className="seller-eyebrow mb-1">Sotuv narxi</p>
          <p className="font-mono text-lg text-foreground">{formatMoney(p.sellingPrice)}</p>
        </div>
        <div className="panel">
          <p className="seller-eyebrow mb-1">Kategoriya</p>
          <p className="text-sm text-foreground">{p.category.name}</p>
        </div>
        <div className="panel">
          <p className="seller-eyebrow mb-1">Brend</p>
          <p className="text-sm text-foreground">{p.brand.name}</p>
        </div>
      </div>

      {p.description ? <p className="type-body text-muted">{p.description}</p> : null}

      <div>
        <p className="type-title mb-3 text-foreground">Ombor bo&apos;yicha qoldiq</p>
        {stock.isError ? (
          <QueryErrorState error={stock.error} onRetry={() => stock.refetch()} />
        ) : stock.isLoading || !stock.data ? (
          <div className="h-32 animate-pulse rounded-lg bg-surface-muted" />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Ombor</TableHeaderCell>
                <TableHeaderCell className="text-right">Jami</TableHeaderCell>
                <TableHeaderCell className="text-right">Band qilingan</TableHeaderCell>
                <TableHeaderCell className="text-right">Mavjud</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {stock.data.byWarehouse.map((row) => (
                <TableRow key={row.warehouseId}>
                  <TableCell>{row.warehouseName}</TableCell>
                  <TableCell className="text-right font-mono">{row.quantity}</TableCell>
                  <TableCell className="text-right font-mono">{row.reservedQuantity}</TableCell>
                  <TableCell className="text-right font-mono">{row.availableQuantity}</TableCell>
                </TableRow>
              ))}
              <TableRow className="font-medium">
                <TableCell>Jami</TableCell>
                <TableCell className="text-right font-mono">{stock.data.totals.quantity}</TableCell>
                <TableCell className="text-right font-mono">{stock.data.totals.reservedQuantity}</TableCell>
                <TableCell className="text-right font-mono">{stock.data.totals.availableQuantity}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
