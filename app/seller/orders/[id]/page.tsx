"use client";

import { useParams } from "next/navigation";
import { useOrder } from "@/hooks/seller/queries/use-order";
import { OrderStatusStepper } from "@/components/seller/order-status";
import { QueryErrorState } from "@/components/seller/query-error-state";
import { Badge } from "@/components/seller/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/seller/ui/table";
import { formatDateTime, formatMoney } from "@/lib/seller/format";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from "@/lib/seller/order-status-labels";

export default function SellerOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: order, isLoading, isError, error, refetch } = useOrder(params.id);

  if (isError) {
    return <QueryErrorState error={error} onRetry={() => refetch()} />;
  }

  if (isLoading || !order) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-8 w-48 animate-pulse rounded-sm bg-surface-muted" />
        <div className="h-40 animate-pulse rounded-md bg-surface-muted" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-mono text-xl font-semibold text-foreground">{order.orderNumber}</h1>
          <p className="mt-1 text-xs text-muted">{formatDateTime(order.createdAt)}</p>
        </div>
        <Badge tone={ORDER_STATUS_TONE[order.status]}>{ORDER_STATUS_LABEL[order.status]}</Badge>
      </div>

      <div className="rounded-md border border-border bg-surface p-4">
        <OrderStatusStepper order={order} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-md border border-border bg-surface p-4">
          <p className="seller-eyebrow mb-2">Mijoz</p>
          <p className="text-sm text-foreground">{order.customer.name}</p>
          <p className="font-mono text-xs text-muted">{order.customer.phone}</p>
        </div>
        <div className="rounded-md border border-border bg-surface p-4">
          <p className="seller-eyebrow mb-2">Ombor</p>
          <p className="text-sm text-foreground">{order.warehouse.name}</p>
        </div>
      </div>

      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>SKU</TableHeaderCell>
            <TableHeaderCell>Mahsulot</TableHeaderCell>
            <TableHeaderCell className="text-right">Miqdor</TableHeaderCell>
            <TableHeaderCell className="text-right">Narx</TableHeaderCell>
            <TableHeaderCell className="text-right">Jami</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {order.items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-mono">{item.product.sku}</TableCell>
              <TableCell>{item.product.name}</TableCell>
              <TableCell className="text-right font-mono">{item.quantity}</TableCell>
              <TableCell className="text-right font-mono">{formatMoney(item.price)}</TableCell>
              <TableCell className="text-right font-mono">{formatMoney(item.total)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="ml-auto flex w-full max-w-xs flex-col gap-1.5 text-sm md:max-w-sm">
        <div className="flex justify-between text-muted">
          <span>Oraliq summa</span>
          <span className="font-mono">{formatMoney(order.subtotal)}</span>
        </div>
        <div className="flex justify-between text-muted">
          <span>Chegirma</span>
          <span className="font-mono">-{formatMoney(order.discount)}</span>
        </div>
        <div className="flex justify-between text-muted">
          <span>Yetkazib berish</span>
          <span className="font-mono">{formatMoney(order.deliveryFee)}</span>
        </div>
        <div className="flex justify-between border-t border-border pt-1.5 text-base font-semibold text-foreground">
          <span>Jami</span>
          <span className="font-mono">{formatMoney(order.total)}</span>
        </div>
      </div>
    </div>
  );
}
