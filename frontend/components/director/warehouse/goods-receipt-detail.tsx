"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Pencil, X } from "lucide-react";
import { useApproveGoodsReceipt, useCancelGoodsReceipt, useGoodsReceipt } from "@/hooks/admin/use-warehouse";
import { requestErrorMessage } from "@/lib/api/request-error";
import { formatInteger, formatSum } from "@/lib/analytics/format";
import { formatDateTime } from "@/lib/warehouse/format";
import type { GoodsReceiptDetail as Receipt } from "@/lib/api/warehouse-repository";
import { Button } from "@/components/ui/shadcn/button";
import { ConfirmModal } from "@/components/ui/form-modal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/shadcn/table";
import { GoodsReceiptStatusBadge } from "./goods-receipt-status-badge";

export function GoodsReceiptDetail({
  id,
  initialData,
}: {
  id: string;
  initialData?: Receipt;
}) {
  const query = useGoodsReceipt(id, initialData);
  const [confirm, setConfirm] = useState<"approve" | "cancel" | null>(null);

  const approve = useApproveGoodsReceipt(() => setConfirm(null));
  const cancel = useCancelGoodsReceipt(() => setConfirm(null));

  if (query.isError) {
    return (
      <p className="rounded-md border border-danger bg-danger-surface px-4 py-3 text-sm text-danger">
        {requestErrorMessage(query.error, "Qabulni yuklab bo'lmadi.")}
      </p>
    );
  }

  const receipt = query.data;
  if (!receipt) {
    return (
      <div aria-busy="true" className="space-y-4">
        <span className="sr-only">Yuklanmoqda…</span>
        <div aria-hidden="true" className="h-24 animate-pulse rounded-lg bg-surface-muted" />
        <div aria-hidden="true" className="h-64 animate-pulse rounded-lg bg-surface-muted" />
      </div>
    );
  }

  const isDraft = receipt.status === "DRAFT";
  const facts: { label: string; value: string }[] = [
    { label: "Ombor", value: `${receipt.warehouseCode} · ${receipt.warehouseName}` },
    { label: "Yetkazib beruvchi", value: receipt.supplierName || "—" },
    { label: "Yaratildi", value: `${formatDateTime(receipt.createdAt)}${receipt.createdByName ? ` · ${receipt.createdByName}` : ""}` },
    {
      label: "Tasdiqlangan",
      value: receipt.approvedAt
        ? `${formatDateTime(receipt.approvedAt)}${receipt.approvedByName ? ` · ${receipt.approvedByName}` : ""}`
        : "—",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="type-page font-mono text-foreground">{receipt.receiptNumber}</h1>
          <GoodsReceiptStatusBadge status={receipt.status} />
        </div>

        {isDraft ? (
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/director/warehouse/incomes/${receipt.id}/edit`}>
                <Pencil className="size-3.5" aria-hidden="true" />
                Tahrirlash
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                cancel.reset();
                setConfirm("cancel");
              }}
            >
              <X className="size-3.5" aria-hidden="true" />
              Bekor qilish
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                approve.reset();
                setConfirm("approve");
              }}
            >
              <Check className="size-3.5" aria-hidden="true" />
              Tasdiqlash
            </Button>
          </div>
        ) : null}
      </div>

      <dl className="grid gap-x-6 gap-y-3 rounded-lg border border-border bg-surface-muted/60 p-4 sm:grid-cols-2">
        {facts.map((fact) => (
          <div key={fact.label} className="flex flex-col">
            <dt className="type-eyebrow text-muted">{fact.label}</dt>
            <dd className="text-sm text-foreground">{fact.value}</dd>
          </div>
        ))}
        {receipt.note ? (
          <div className="flex flex-col sm:col-span-2">
            <dt className="type-eyebrow text-muted">Izoh</dt>
            <dd className="text-sm text-foreground">{receipt.note}</dd>
          </div>
        ) : null}
      </dl>

      <div className="panel overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mahsulot</TableHead>
              <TableHead className="text-right">Miqdor</TableHead>
              <TableHead className="text-right">Birlik tannarxi</TableHead>
              <TableHead className="text-right">Jami</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {receipt.lines.map((line) => (
              <TableRow key={line.id}>
                <TableCell>
                  <span className="block text-foreground">{line.productName}</span>
                  <span className="block font-mono text-xs text-muted">{line.productSku}</span>
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums text-foreground">
                  {formatInteger(line.quantity)} {line.unit}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums text-muted">
                  {formatSum(line.unitCost)}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums text-foreground">
                  {formatSum(line.lineTotal)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <dl className="ml-auto max-w-xs space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-muted">Qatorlar summasi</dt>
          <dd className="font-mono tabular-nums text-foreground">{formatSum(receipt.subtotal)}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted">Chegirma</dt>
          <dd className="font-mono tabular-nums text-muted">−{formatSum(receipt.discount)}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted">Soliq</dt>
          <dd className="font-mono tabular-nums text-muted">+{formatSum(receipt.tax)}</dd>
        </div>
        <div className="flex items-center justify-between border-t border-border pt-2">
          <dt className="font-medium text-foreground">Umumiy</dt>
          <dd className="type-title font-mono tabular-nums text-foreground">{formatSum(receipt.total)}</dd>
        </div>
      </dl>

      <ConfirmModal
        open={confirm === "approve"}
        onOpenChange={() => setConfirm(null)}
        title="Qabul tasdiqlansinmi?"
        subject={`${receipt.receiptNumber} · ${receipt.lines.length} ta qator · ${formatSum(receipt.total)}`}
        warning="Tasdiqlangandan so'ng qatorlardagi miqdorlar omborga kiritiladi va tannarx qayta hisoblanadi. Buni ortga qaytarib bo'lmaydi."
        confirmLabel="Tasdiqlash"
        busy={approve.isPending}
        error={
          approve.isError ? requestErrorMessage(approve.error, "Tasdiqlab bo'lmadi.") : null
        }
        onConfirm={() => approve.mutate({ id: receipt.id })}
      />

      <ConfirmModal
        open={confirm === "cancel"}
        onOpenChange={() => setConfirm(null)}
        title="Qabul bekor qilinsinmi?"
        subject={`${receipt.receiptNumber} · ${formatSum(receipt.total)}`}
        warning="Qoralama bekor qilinadi. Hech qanday qoldiq o'zgarmaydi."
        confirmLabel="Bekor qilish"
        busy={cancel.isPending}
        error={cancel.isError ? requestErrorMessage(cancel.error, "Bekor qilib bo'lmadi.") : null}
        onConfirm={() => cancel.mutate({ id: receipt.id })}
      />
    </div>
  );
}
