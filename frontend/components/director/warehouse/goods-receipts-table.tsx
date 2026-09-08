"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList, Plus, Search } from "lucide-react";
import { useGoodsReceipts } from "@/hooks/admin/use-warehouse";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { requestErrorMessage } from "@/lib/api/request-error";
import { formatInteger, formatSum } from "@/lib/analytics/format";
import { formatDate } from "@/lib/warehouse/format";
import type { GoodsReceiptListQuery } from "@/lib/schemas";
import type { GoodsReceiptPage } from "@/lib/api/warehouse-repository";
import { EmptyState } from "@/components/director/empty-state";
import { FilterBar, FilterField } from "@/components/director/filter-bar";
import { Button } from "@/components/ui/shadcn/button";
import { Input } from "@/components/ui/shadcn/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/shadcn/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/shadcn/table";
import { GoodsReceiptStatusBadge } from "./goods-receipt-status-badge";

const STATUS_OPTIONS = [
  { value: "all", label: "Barcha holatlar" },
  { value: "DRAFT", label: "Qoralama" },
  { value: "APPROVED", label: "Tasdiqlangan" },
  { value: "CANCELLED", label: "Bekor qilingan" },
] as const;

export function GoodsReceiptsTable({
  query,
  initialData,
}: {
  query: GoodsReceiptListQuery;
  initialData?: GoodsReceiptPage;
}) {
  const router = useRouter();
  const list = useGoodsReceipts(query, initialData);

  const [term, setTerm] = useState(query.q);
  const debounced = useDebouncedValue(term, 350);
  const lastPushed = useRef(query.q);

  function navigate(next: Partial<Record<"q" | "status", string>>) {
    const params = new URLSearchParams();
    const q = next.q ?? query.q;
    const status = next.status ?? query.status ?? "";
    if (q) params.set("q", q);
    if (status && status !== "all") params.set("status", status);
    const search = params.toString();
    router.replace("/director/warehouse/incomes" + (search ? "?" + search : ""));
  }

  useEffect(() => {
    if (debounced === lastPushed.current) return;
    lastPushed.current = debounced;
    navigate({ q: debounced });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const rows = list.data?.items ?? [];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <FilterBar>
          <FilterField label="Raqam yoki yetkazib beruvchi">
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted"
              />
              <Input
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                className="h-9 w-60 pl-8"
                placeholder="GR-2026-0007"
                aria-label="Qidiruv"
              />
            </div>
          </FilterField>
          <FilterField label="Holat">
            <Select
              value={query.status ?? "all"}
              onValueChange={(value) => navigate({ status: value })}
            >
              <SelectTrigger className="h-9 w-44" aria-label="Holat bo'yicha filtr">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
        </FilterBar>

        <Button asChild>
          <Link href="/director/warehouse/incomes/new">
            <Plus className="size-4" aria-hidden="true" />
            Yangi qabul
          </Link>
        </Button>
      </div>

      <div className="panel mt-4 overflow-x-auto">
        {list.isPending ? (
          <div aria-busy="true" className="flex flex-col gap-2">
            <span className="sr-only">Yuklanmoqda…</span>
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} aria-hidden="true" className="h-11 animate-pulse rounded-md bg-surface-muted" />
            ))}
          </div>
        ) : list.isError ? (
          <div className="py-6 text-center">
            <p className="type-body text-muted">
              {requestErrorMessage(list.error, "Qabullar yuklanmadi.")}
            </p>
            <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => void list.refetch()}>
              Qayta urinish
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Hali qabul yo'q"
            message="Yetkazib beruvchidan kelgan mahsulotni birinchi qabul bilan omborga kiriting."
            action={
              <Button asChild>
                <Link href="/director/warehouse/incomes/new">
                  <Plus className="size-4" aria-hidden="true" />
                  Yangi qabul
                </Link>
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Raqam</TableHead>
                <TableHead>Sana</TableHead>
                <TableHead>Ombor</TableHead>
                <TableHead>Yetkazib beruvchi</TableHead>
                <TableHead className="text-right">Qatorlar</TableHead>
                <TableHead className="text-right">Summa</TableHead>
                <TableHead className="text-right">Holat</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((receipt) => (
                <TableRow key={receipt.id}>
                  <TableCell className="font-mono text-xs">
                    <Link
                      href={`/director/warehouse/incomes/${receipt.id}`}
                      className="text-foreground transition-colors hover:text-accent-strong"
                    >
                      {receipt.receiptNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted">
                    {formatDate(receipt.createdAt)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span className="font-mono text-xs text-muted">{receipt.warehouseCode}</span>
                    <span className="ml-2 text-muted">{receipt.warehouseName}</span>
                  </TableCell>
                  <TableCell className="text-muted">{receipt.supplierName || "—"}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-muted">
                    {formatInteger(receipt.itemCount)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-foreground">
                    {formatSum(receipt.total)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end">
                      <GoodsReceiptStatusBadge status={receipt.status} />
                    </div>
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

function Pager({
  query,
  meta,
}: {
  query: GoodsReceiptListQuery;
  meta: { page: number; totalPages: number };
}) {
  const href = (next: number) => {
    const params = new URLSearchParams();
    if (query.q) params.set("q", query.q);
    if (query.status) params.set("status", query.status);
    if (next > 1) params.set("page", String(next));
    const search = params.toString();
    return "/director/warehouse/incomes" + (search ? "?" + search : "");
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
