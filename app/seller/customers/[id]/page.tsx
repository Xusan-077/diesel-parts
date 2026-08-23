"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { useCustomer, useCustomerOrders } from "@/hooks/seller/queries/use-customer";
import { QueryErrorState } from "@/components/seller/query-error-state";
import { EmptyState } from "@/components/seller/empty-state";
import { TableSkeleton } from "@/components/seller/table-skeleton";
import { PaginationBar } from "@/components/seller/pagination-bar";
import { Badge } from "@/components/seller/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/seller/ui/table";
import { formatDate, formatMoney } from "@/lib/seller/format";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from "@/lib/seller/order-status-labels";

export default function SellerCustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const [page, setPage] = useState(1);
  const customer = useCustomer(params.id);
  const orders = useCustomerOrders(params.id, page);

  if (customer.isError) {
    return <QueryErrorState error={customer.error} onRetry={() => customer.refetch()} />;
  }

  if (customer.isLoading || !customer.data) {
    return <div className="h-40 animate-pulse rounded-md bg-surface-muted" />;
  }

  const c = customer.data;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{c.name}</h1>
        <p className="mt-1 font-mono text-sm text-muted">{c.phone}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-md border border-border bg-surface p-4">
          <p className="seller-eyebrow mb-1">Qarzdorlik</p>
          <p className="font-mono text-lg text-foreground">{formatMoney(c.debt)}</p>
        </div>
        {c.telegram ? (
          <div className="rounded-md border border-border bg-surface p-4">
            <p className="seller-eyebrow mb-1">Telegram</p>
            <p className="text-sm text-foreground">{c.telegram}</p>
          </div>
        ) : null}
        <div className="rounded-md border border-border bg-surface p-4">
          <p className="seller-eyebrow mb-1">Ro&apos;yxatdan o&apos;tgan</p>
          <p className="text-sm text-foreground">{formatDate(c.createdAt)}</p>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-foreground">Buyurtmalar tarixi</p>
        {orders.isError ? (
          <QueryErrorState error={orders.error} onRetry={() => orders.refetch()} />
        ) : !orders.isLoading && orders.data && orders.data.data.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Buyurtmalar yo'q" description="Bu mijoz hali sizdan buyurtma bermagan." />
        ) : (
          <Table footer={orders.data ? <PaginationBar meta={orders.data.meta} onPageChange={setPage} /> : null}>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Buyurtma</TableHeaderCell>
                <TableHeaderCell>Sana</TableHeaderCell>
                <TableHeaderCell>Holat</TableHeaderCell>
                <TableHeaderCell className="text-right">Summa</TableHeaderCell>
                <TableHeaderCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {orders.isLoading || !orders.data
                ? <TableSkeleton rows={4} columns={5} />
                : orders.data.data.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono">{order.orderNumber}</TableCell>
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
        )}
      </div>
    </div>
  );
}
