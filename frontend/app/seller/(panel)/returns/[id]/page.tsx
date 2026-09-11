"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useReturn } from "@/hooks/seller/queries/use-return";
import { QueryErrorState } from "@/components/seller/query-error-state";
import { Badge } from "@/components/seller/ui/badge";
import { Skeleton } from "@/components/ui/shadcn/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/seller/ui/table";
import { formatDateTime, formatMoney } from "@/lib/seller/format";
import {
  RETURN_CONDITION_LABEL,
  RETURN_REASON_LABEL,
  RETURN_STATUS_LABEL,
  RETURN_STATUS_TONE,
} from "@/lib/seller/return-labels";

const REFUND_METHOD_LABEL: Record<string, string> = {
  CASH: "Naqd",
  CARD: "Karta",
  TRANSFER: "O'tkazma",
  ONLINE: "Onlayn",
  SELLER_AGREEMENT: "Kelishuv asosida",
  PAYME: "Payme",
  CLICK: "Click",
  PAYNET: "Paynet",
};

export default function SellerReturnDetailPage() {
  const params = useParams<{ id: string }>();
  const {
    data: ret,
    isLoading,
    isError,
    error,
    refetch,
  } = useReturn(params.id);

  if (isError) {
    return <QueryErrorState error={error} onRetry={() => refetch()} />;
  }

  if (isLoading || !ret) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48 bg-surface-muted" />
        <Skeleton className="h-40 bg-surface-muted" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-6">
        <div>
          <p className="type-eyebrow flex items-center gap-2 text-muted">
            <span
              aria-hidden="true"
              className="h-3 w-0.5 shrink-0 bg-accent-strong"
            />
            Qaytarish
          </p>
          <h1 className="type-page mt-1 font-mono text-foreground">
            {ret.returnNumber}
          </h1>
          <p className="type-caption mt-2 text-muted">
            {formatDateTime(ret.createdAt)}
          </p>
        </div>
        <Badge tone={RETURN_STATUS_TONE[ret.status]}>
          {RETURN_STATUS_LABEL[ret.status]}
        </Badge>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="panel">
          <p className="seller-eyebrow mb-2">Sotuv</p>
          <Link
            href={`/seller/orders/${ret.order.id}`}
            className="font-mono text-sm text-accent-strong hover:underline"
          >
            {ret.order.orderNumber}
          </Link>
          <p className="mt-1 text-xs text-muted">{ret.order.customer.name}</p>
        </div>
        <div className="panel">
          <p className="seller-eyebrow mb-2">To&apos;lov usuli</p>
          <p className="text-sm text-foreground">
            {REFUND_METHOD_LABEL[ret.refundMethod] ?? "Boshqa"}
          </p>
        </div>
        <div className="panel">
          <p className="seller-eyebrow mb-2">Sotuvchi</p>
          <p className="text-sm text-foreground">{ret.seller.name}</p>
        </div>
      </div>

      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>SKU</TableHeaderCell>
            <TableHeaderCell>Mahsulot</TableHeaderCell>
            <TableHeaderCell className="text-right">Miqdor</TableHeaderCell>
            <TableHeaderCell>Sabab</TableHeaderCell>
            <TableHeaderCell>Holati</TableHeaderCell>
            <TableHeaderCell className="text-right">Summa</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {ret.items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-mono">{item.product.sku}</TableCell>
              <TableCell>{item.product.nameEn}</TableCell>
              <TableCell className="text-right font-mono">{item.qty}</TableCell>
              <TableCell>{RETURN_REASON_LABEL[item.reason]}</TableCell>
              <TableCell>{RETURN_CONDITION_LABEL[item.condition]}</TableCell>
              <TableCell className="text-right font-mono">
                {formatMoney(item.lineTotal)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="ml-auto flex w-full max-w-xs flex-col gap-1.5 text-sm md:max-w-sm">
        <div className="flex justify-between border-t border-border pt-1.5 text-base font-semibold text-foreground">
          <span>Qaytarilgan summa</span>
          <span className="font-mono">{formatMoney(ret.refundAmount)}</span>
        </div>
      </div>
    </div>
  );
}
