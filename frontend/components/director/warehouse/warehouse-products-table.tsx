"use client";

import Link from "next/link";
import { PackageSearch } from "lucide-react";
import { useWarehouseProducts } from "@/hooks/admin/use-warehouse";
import { requestErrorMessage } from "@/lib/api/request-error";
import { formatInteger, formatSum } from "@/lib/analytics/format";
import type { WarehouseProductListQuery } from "@/lib/schemas";
import type { WarehouseProductPage } from "@/lib/api/warehouse-repository";
import { EmptyState } from "@/components/director/empty-state";
import { StockStatusBadge } from "@/components/director/stock-status-badge";
import { Button } from "@/components/ui/shadcn/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/shadcn/table";

/**
 * The warehouse view of the catalog: every product with its stock position and
 * cost. Read-only — creating and editing a product is one write path, and it
 * lives at /director/products; a row here links there. Figures are summed
 * across every warehouse unless a warehouse filter narrows them, which the
 * caller signals with `scoped`.
 *
 * URL state (search / status / page) is resolved in `page.tsx` and is this
 * table's cache key, so the count and the pager come from the same query as
 * the rows.
 */
export function WarehouseProductsTable({
  query,
  initialData,
  scopedLabel,
}: {
  query: WarehouseProductListQuery;
  initialData?: WarehouseProductPage;
  /** Name of the warehouse the figures are scoped to, or null for "all". */
  scopedLabel: string | null;
}) {
  const list = useWarehouseProducts(query, initialData);
  const rows = list.data?.items ?? [];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-xs tabular-nums text-muted">
          {list.data === undefined
            ? " "
            : formatInteger(list.data.meta.total) +
              " ta mahsulot" +
              (scopedLabel ? ` · ${scopedLabel} bo'yicha` : "")}
        </p>
      </div>

      <div className="panel mt-4 overflow-x-auto">
        {list.isPending ? (
          <TableSkeleton />
        ) : list.isError ? (
          <div className="py-6 text-center">
            <p className="type-body text-muted">
              {requestErrorMessage(list.error, "Ro'yxat yuklanmadi.")}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => void list.refetch()}
            >
              Qayta urinish
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={PackageSearch}
            message="Hech narsa topilmadi. Qidiruvni yoki filtrni o'zgartiring."
          />
        ) : (
          <Table className="min-w-5xl">
            <TableHeader>
              <TableRow>
                <TableHead className="sticky top-0 z-10 bg-surface">Mahsulot</TableHead>
                <TableHead className="sticky top-0 z-10 bg-surface">SKU / OEM</TableHead>
                <TableHead className="sticky top-0 z-10 bg-surface">Shtrix-kod</TableHead>
                <TableHead className="sticky top-0 z-10 bg-surface text-right">Qoldiq</TableHead>
                <TableHead className="sticky top-0 z-10 bg-surface text-right">Zaxirada</TableHead>
                <TableHead className="sticky top-0 z-10 bg-surface text-right">Mavjud</TableHead>
                <TableHead className="sticky top-0 z-10 bg-surface text-right">Tannarx</TableHead>
                <TableHead className="sticky top-0 z-10 bg-surface text-right">Holat</TableHead>
                <TableHead className="sticky top-0 z-10 bg-surface w-10 text-right">
                  <span className="sr-only">Amallar</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="min-w-0">
                    <Link
                      href={`/director/warehouse/products/${product.id}`}
                      className="text-foreground transition-colors hover:text-accent-strong"
                    >
                      {product.name}
                    </Link>
                    {product.categoryName ? (
                      <span className="ml-2 text-xs text-muted">{product.categoryName}</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted">
                    <span className="text-foreground">{product.sku}</span>
                    {product.oemNumbers.length > 0 ? (
                      <span className="block truncate">{product.oemNumbers.join(", ")}</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted">
                    {product.barcode ?? "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-foreground">
                    {formatInteger(product.onHand)}
                    <span className="ml-1 text-muted">/ {formatInteger(product.minStock)}</span>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-muted">
                    {formatInteger(product.reserved)}
                  </TableCell>
                  <TableCell
                    className={
                      "text-right font-mono tabular-nums " +
                      (product.available <= 0
                        ? "text-danger"
                        : product.available <= product.minStock
                          ? "text-warning"
                          : "text-foreground")
                    }
                  >
                    {formatInteger(product.available)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-muted">
                    {product.unitCost === null ? "—" : formatSum(product.unitCost)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end">
                      <StockStatusBadge status={product.status} />
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/director/warehouse/products/${product.id}`}
                      className="text-xs font-medium text-accent-strong hover:underline"
                    >
                      Ko&apos;rish
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {list.data !== undefined && list.data.meta.totalPages > 1 ? (
        <Pager query={query} meta={list.data.meta} />
      ) : null}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div aria-busy="true">
      <span className="sr-only">Yuklanmoqda…</span>
      <div aria-hidden="true" className="flex flex-col gap-2">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="h-11 animate-pulse rounded-md bg-surface-muted" />
        ))}
      </div>
    </div>
  );
}

function Pager({
  query,
  meta,
}: {
  query: WarehouseProductListQuery;
  meta: { page: number; totalPages: number };
}) {
  const href = (next: number) => {
    const params = new URLSearchParams();
    if (query.q) params.set("q", query.q);
    if (query.status) params.set("status", query.status);
    if (query.warehouseId) params.set("warehouseId", query.warehouseId);
    if (next > 1) params.set("page", String(next));
    const search = params.toString();
    return "/director/warehouse/products" + (search ? "?" + search : "");
  };

  return (
    <nav aria-label="Sahifalar" className="mt-6 flex items-center gap-3 text-sm">
      {meta.page > 1 ? (
        <Link href={href(meta.page - 1)} className="text-muted transition-colors hover:text-foreground">
          ← Oldingi
        </Link>
      ) : null}
      <span className="font-mono text-xs text-muted">
        {meta.page} / {meta.totalPages}
      </span>
      {meta.page < meta.totalPages ? (
        <Link href={href(meta.page + 1)} className="text-muted transition-colors hover:text-foreground">
          Keyingi →
        </Link>
      ) : null}
    </nav>
  );
}
