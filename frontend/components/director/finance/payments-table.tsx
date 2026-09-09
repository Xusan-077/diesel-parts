"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Coins, Search } from "lucide-react";
import { useFinancePayments } from "@/hooks/admin/use-finance";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { requestErrorMessage } from "@/lib/api/request-error";
import { formatSum } from "@/lib/analytics/format";
import { formatDate } from "@/lib/finance/format";
import { financeListUrl } from "@/lib/finance/list-url";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/finance/labels";
import type { FinancePaymentListQuery } from "@/lib/schemas";
import type { FinancePaymentPage } from "@/lib/api/finance-repository";
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
import { DateRangeFields } from "./date-range-fields";
import { FinancePager } from "./finance-pager";
import { PaymentMethodBadge } from "./finance-badges";

const BASE = "/director/finance";
const ALL = "all";

export function PaymentsTable({
  query,
  initialData,
}: {
  query: FinancePaymentListQuery;
  initialData?: FinancePaymentPage;
}) {
  const router = useRouter();
  const list = useFinancePayments(query, initialData);

  const [term, setTerm] = useState(query.q);
  const debounced = useDebouncedValue(term, 350);
  const lastPushed = useRef(query.q);

  function navigate(next: Partial<Record<"q" | "method" | "dateFrom" | "dateTo", string | undefined>>) {
    router.replace(
      financeListUrl(BASE, {
        q: next.q ?? query.q,
        method: (next.method ?? query.method) === ALL ? undefined : next.method ?? query.method,
        dateFrom: "dateFrom" in next ? next.dateFrom : query.dateFrom,
        dateTo: "dateTo" in next ? next.dateTo : query.dateTo,
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
              placeholder="DP-2026-0042"
              aria-label="Qidiruv"
            />
          </div>
        </FilterField>
        <FilterField label="To'lov turi">
          <Select
            value={query.method ?? ALL}
            onValueChange={(value) => navigate({ method: value })}
          >
            <SelectTrigger className="h-9 w-40" aria-label="To'lov turi bo'yicha filtr">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Barcha turlar</SelectItem>
              {PAYMENT_METHOD_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <DateRangeFields
          from={query.dateFrom}
          to={query.dateTo}
          onChange={(next) => navigate(next)}
        />
      </FilterBar>

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
              {requestErrorMessage(list.error, "To'lovlar yuklanmadi.")}
            </p>
            <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => void list.refetch()}>
              Qayta urinish
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Coins}
            title="To'lovlar topilmadi"
            message="Tanlangan filtrlar bo'yicha tugallangan to'lov yo'q. Mijoz to'lovlari shu yerda ko'rinadi."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sana</TableHead>
                <TableHead>Buyurtma</TableHead>
                <TableHead>Mijoz</TableHead>
                <TableHead>Turi</TableHead>
                <TableHead className="text-right">Summa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="whitespace-nowrap text-muted">
                    {payment.paidAt ? formatDate(payment.paidAt) : "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted">
                    {payment.orderNumber}
                  </TableCell>
                  <TableCell className="text-muted">{payment.customerName}</TableCell>
                  <TableCell>
                    <PaymentMethodBadge method={payment.method} />
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-success">
                    {formatSum(payment.amount)}
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
          hrefFor={(page) =>
            financeListUrl(BASE, {
              q: query.q,
              method: query.method,
              dateFrom: query.dateFrom,
              dateTo: query.dateTo,
              page,
            })
          }
        />
      ) : null}
    </div>
  );
}
