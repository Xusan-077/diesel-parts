"use client";

import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/seller/ui/table";
import { Badge } from "@/components/seller/ui/badge";
import { TableSkeleton } from "@/components/seller/table-skeleton";
import { EmptyState } from "@/components/seller/empty-state";
import { PaginationBar } from "@/components/seller/pagination-bar";
import { QueryErrorState } from "@/components/seller/query-error-state";
import { formatDate, formatMoney } from "@/lib/seller/format";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from "@/lib/seller/order-status-labels";
import type { Order, PaginationMeta } from "@/lib/api/seller-panel/types";

const COLUMN_COUNT = 6;

export function OrdersTable({
  orders,
  meta,
  isLoading,
  isError,
  error,
  onRetry,
  onPageChange,
}: {
  orders: Order[] | undefined;
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

  if (!isLoading && orders && orders.length === 0) {
    return <EmptyState icon={ClipboardList} title="Buyurtmalar yo'q" description="Hozircha bu bo'limda buyurtma topilmadi." />;
  }

  return (
    <Table footer={meta ? <PaginationBar meta={meta} onPageChange={onPageChange} /> : null}>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Buyurtma</TableHeaderCell>
          <TableHeaderCell>Mijoz</TableHeaderCell>
          <TableHeaderCell>Sana</TableHeaderCell>
          <TableHeaderCell>Holat</TableHeaderCell>
          <TableHeaderCell className="text-right">Summa</TableHeaderCell>
          <TableHeaderCell />
        </TableRow>
      </TableHead>
      <TableBody>
        {isLoading || !orders
          ? <TableSkeleton rows={8} columns={COLUMN_COUNT} />
          : orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-mono">{order.orderNumber}</TableCell>
                <TableCell>{order.customer.name}</TableCell>
                <TableCell className="text-muted">{formatDate(order.createdAt)}</TableCell>
                <TableCell>
                  <Badge tone={ORDER_STATUS_TONE[order.status]}>{ORDER_STATUS_LABEL[order.status]}</Badge>
                </TableCell>
                <TableCell className="text-right font-mono">{formatMoney(order.total)}</TableCell>
                <TableCell className="text-right">
                  <Link href={`/seller/orders/${order.id}`} className="text-xs font-medium text-accent hover:underline">
                    Ko&apos;rish
                  </Link>
                </TableCell>
              </TableRow>
            ))}
      </TableBody>
    </Table>
  );
}
