"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HandCoins, Search, Wallet } from "lucide-react";
import { useFinanceDebts } from "@/hooks/admin/use-finance";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { requestErrorMessage } from "@/lib/api/request-error";
import { formatInteger, formatSum } from "@/lib/analytics/format";
import { formatDate } from "@/lib/finance/format";
import { financeListUrl } from "@/lib/finance/list-url";
import { DEBT_STATUS_LABEL } from "@/lib/finance/labels";
import type { FinanceDebtListQuery } from "@/lib/schemas";
import type { DebtPage, DebtRow } from "@/lib/api/finance-repository";
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
import { FinancePager } from "./finance-pager";
import { DebtStatusBadge } from "./finance-badges";
import { DebtPaymentModal } from "./debt-payment-modal";

const BASE = "/director/finance/debts";
const ALL = "all";

const STATUS_OPTIONS = [
  { value: ALL, label: "Barchasi" },
  { value: "UNPAID", label: DEBT_STATUS_LABEL.UNPAID },
  { value: "PARTIAL", label: DEBT_STATUS_LABEL.PARTIAL },
] as const;

export function DebtsTable({
  query,
  initialData,
}: {
  query: FinanceDebtListQuery;
  initialData?: DebtPage;
}) {
  const router = useRouter();
  const list = useFinanceDebts(query, initialData);
  const [paying, setPaying] = useState<DebtRow | null>(null);

  const [term, setTerm] = useState(query.q);
  const debounced = useDebouncedValue(term, 350);
  const lastPushed = useRef(query.q);

  function navigate(next: Partial<Record<"q" | "status", string | undefined>>) {
    router.replace(
      financeListUrl(BASE, {
        q: next.q ?? query.q,
        status: (next.status ?? query.status) === ALL ? undefined : next.status ?? query.status,
      }),
    );
  }

  useEffect(() => {
    if (debounced === lastPushed.current) return;
    lastPushed.current = debounced;
    navigate({ q: debounced });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const rows = list.data?.items ?? [];
  const totals = list.data?.totals;

  return (
    <div>
      <FilterBar>
        <FilterField label="Buyurtma raqami yoki mijoz">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted"
            />
            <Input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              className="h-9 w-60 pl-8"
              placeholder="DP-2026-0031"
              aria-label="Qidiruv"
            />
          </div>
        </FilterField>
        <FilterField label="Holat">
          <Select
            value={query.status ?? ALL}
            onValueChange={(value) => navigate({ status: value })}
          >
            <SelectTrigger className="h-9 w-40" aria-label="Holat bo'yicha filtr">
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

      {totals && totals.count > 0 ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted">
          <Wallet className="size-4 text-warning" aria-hidden="true" />
          {formatInteger(totals.count)} ta qarzdor · jami qoldiq{" "}
          <span className="font-mono tabular-nums text-foreground">{formatSum(totals.remaining)}</span>
        </p>
      ) : null}

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
              {requestErrorMessage(list.error, "Qarzdorlik yuklanmadi.")}
            </p>
            <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => void list.refetch()}>
              Qayta urinish
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={HandCoins}
            title="Qarzdorlik yo'q"
            message="Nasiyaga berilgan va to'liq yopilmagan buyurtmalar shu yerda ko'rinadi."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sana</TableHead>
                <TableHead>Buyurtma</TableHead>
                <TableHead>Mijoz</TableHead>
                <TableHead className="text-right">Jami</TableHead>
                <TableHead className="text-right">To&apos;langan</TableHead>
                <TableHead className="text-right">Qoldiq</TableHead>
                <TableHead className="text-right">Holat</TableHead>
                <TableHead className="w-10 text-right">
                  <span className="sr-only">Amallar</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.orderId}>
                  <TableCell className="whitespace-nowrap text-muted">
                    {formatDate(row.createdAt)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted">{row.orderNumber}</TableCell>
                  <TableCell>
                    <span className="text-foreground">{row.customerName}</span>
                    {row.customerPhone ? (
                      <span className="block font-mono text-xs text-muted">{row.customerPhone}</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-muted">
                    {formatSum(row.total)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-success">
                    {formatSum(row.paid)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-warning">
                    {formatSum(row.remaining)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end">
                      <DebtStatusBadge status={row.status} />
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => setPaying(row)}
                    >
                      <HandCoins className="size-4" aria-hidden="true" />
                      To&apos;lov
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {list.data ? (
        <FinancePager
          page={list.data.meta.page}
          totalPages={list.data.meta.totalPages}
          hrefFor={(page) => financeListUrl(BASE, { q: query.q, status: query.status, page })}
        />
      ) : null}

      {paying ? (
        <DebtPaymentModal
          key={paying.orderId}
          open
          onOpenChange={() => setPaying(null)}
          debt={paying}
          onDone={() => setPaying(null)}
        />
      ) : null}
    </div>
  );
}
