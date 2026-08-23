"use client";

import Link from "next/link";
import { Package } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/seller/ui/table";
import { Badge } from "@/components/seller/ui/badge";
import { TableSkeleton } from "@/components/seller/table-skeleton";
import { EmptyState } from "@/components/seller/empty-state";
import { PaginationBar } from "@/components/seller/pagination-bar";
import { QueryErrorState } from "@/components/seller/query-error-state";
import { formatMoney } from "@/lib/seller/format";
import { STOCK_STATUS_LABEL, STOCK_STATUS_TONE } from "@/lib/seller/stock-status-labels";
import type { PaginationMeta, SellerProduct } from "@/lib/api/seller-panel/types";

const COLUMN_COUNT = 6;

export function ProductTable({
  products,
  meta,
  isLoading,
  isError,
  error,
  onRetry,
  onPageChange,
}: {
  products: SellerProduct[] | undefined;
  meta: PaginationMeta | undefined;
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  onRetry: () => void;
  onPageChange: (page: number) => void;
}) {
  if (isError) {
    return <QueryErrorState error={error} onRetry={onRetry} />;
  }

  if (!isLoading && products && products.length === 0) {
    return <EmptyState icon={Package} title="Mahsulot topilmadi" description="Qidiruv yoki filtrni o'zgartirib ko'ring." />;
  }

  return (
    <Table footer={meta ? <PaginationBar meta={meta} onPageChange={onPageChange} /> : null}>
      <TableHead>
        <TableRow>
          <TableHeaderCell>SKU</TableHeaderCell>
          <TableHeaderCell>Nomi</TableHeaderCell>
          <TableHeaderCell>Brend</TableHeaderCell>
          <TableHeaderCell className="text-right">Narxi</TableHeaderCell>
          <TableHeaderCell className="text-right">Qoldiq</TableHeaderCell>
          <TableHeaderCell>Holat</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {isLoading || !products
          ? <TableSkeleton rows={8} columns={COLUMN_COUNT} />
          : products.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-mono">
                  <Link href={`/seller/products/${product.id}`} className="text-accent hover:underline">
                    {product.sku}
                  </Link>
                </TableCell>
                <TableCell>{product.name}</TableCell>
                <TableCell className="text-muted">{product.brand.name}</TableCell>
                <TableCell className="text-right font-mono">{formatMoney(product.sellingPrice)}</TableCell>
                <TableCell className="text-right font-mono">{product.availableQuantity}</TableCell>
                <TableCell>
                  <Badge tone={STOCK_STATUS_TONE[product.stockStatus]}>{STOCK_STATUS_LABEL[product.stockStatus]}</Badge>
                </TableCell>
              </TableRow>
            ))}
      </TableBody>
    </Table>
  );
}
