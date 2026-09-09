"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Plus, Receipt, Search, Trash2 } from "lucide-react";
import { useFinanceExpenses, useDeleteExpense } from "@/hooks/admin/use-finance";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { requestErrorMessage } from "@/lib/api/request-error";
import { formatSum } from "@/lib/analytics/format";
import { formatDate } from "@/lib/finance/format";
import { financeListUrl } from "@/lib/finance/list-url";
import { EXPENSE_CATEGORY_OPTIONS } from "@/lib/finance/labels";
import type { FinanceExpenseListQuery } from "@/lib/schemas";
import type { ExpensePage, ExpenseRow } from "@/lib/api/finance-repository";
import { EmptyState } from "@/components/director/empty-state";
import { FilterBar, FilterField } from "@/components/director/filter-bar";
import { Button } from "@/components/ui/shadcn/button";
import { Input } from "@/components/ui/shadcn/input";
import { ConfirmModal } from "@/components/ui/form-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/shadcn/dropdown-menu";
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
import { ExpenseCategoryBadge } from "./finance-badges";
import { ExpenseFormModal } from "./expense-form-modal";

const BASE = "/director/finance/expenses";
const ALL = "all";

type Dialog =
  | { kind: "create" }
  | { kind: "edit"; row: ExpenseRow }
  | { kind: "delete"; row: ExpenseRow }
  | null;

export function ExpensesTable({
  query,
  initialData,
}: {
  query: FinanceExpenseListQuery;
  initialData?: ExpensePage;
}) {
  const router = useRouter();
  const list = useFinanceExpenses(query, initialData);
  const [dialog, setDialog] = useState<Dialog>(null);

  const remove = useDeleteExpense(() => setDialog(null));
  const deleteError =
    remove.isError && dialog?.kind === "delete"
      ? requestErrorMessage(remove.error, "O'chirib bo'lmadi.")
      : null;

  const [term, setTerm] = useState(query.q);
  const debounced = useDebouncedValue(term, 350);
  const lastPushed = useRef(query.q);

  function navigate(
    next: Partial<Record<"q" | "category" | "dateFrom" | "dateTo", string | undefined>>,
  ) {
    router.replace(
      financeListUrl(BASE, {
        q: next.q ?? query.q,
        category:
          (next.category ?? query.category) === ALL ? undefined : next.category ?? query.category,
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <FilterBar>
          <FilterField label="Nomi bo'yicha">
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted"
              />
              <Input
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                className="h-9 w-56 pl-8"
                placeholder="Ijara, oylik…"
                aria-label="Qidiruv"
              />
            </div>
          </FilterField>
          <FilterField label="Turkum">
            <Select
              value={query.category ?? ALL}
              onValueChange={(value) => navigate({ category: value })}
            >
              <SelectTrigger className="h-9 w-40" aria-label="Turkum bo'yicha filtr">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Barcha turkumlar</SelectItem>
                {EXPENSE_CATEGORY_OPTIONS.map((option) => (
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

        <Button type="button" onClick={() => setDialog({ kind: "create" })}>
          <Plus className="size-4" aria-hidden="true" />
          Yangi xarajat
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
              {requestErrorMessage(list.error, "Xarajatlar yuklanmadi.")}
            </p>
            <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => void list.refetch()}>
              Qayta urinish
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Xarajat yo'q"
            message="Ijara, oylik, kommunal va boshqa chiqimlarni shu yerda yuriting."
            action={
              <Button type="button" onClick={() => setDialog({ kind: "create" })}>
                <Plus className="size-4" aria-hidden="true" />
                Yangi xarajat
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sana</TableHead>
                <TableHead>Nomi</TableHead>
                <TableHead>Turkum</TableHead>
                <TableHead>Kim kiritdi</TableHead>
                <TableHead className="text-right">Summa</TableHead>
                <TableHead className="w-10 text-right">
                  <span className="sr-only">Amallar</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-muted">
                    {formatDate(row.spentAt)}
                  </TableCell>
                  <TableCell className="text-foreground">
                    {row.title}
                    {row.note ? (
                      <span className="block max-w-xs truncate text-xs text-muted">{row.note}</span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <ExpenseCategoryBadge category={row.category} />
                  </TableCell>
                  <TableCell className="text-muted">{row.createdByName || "—"}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-danger">
                    {formatSum(row.amount)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label={"Amallar: " + row.title}
                        >
                          <MoreHorizontal className="size-4" aria-hidden="true" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setDialog({ kind: "edit", row })}>
                          <Pencil className="size-4" aria-hidden="true" />
                          Tahrirlash
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => {
                            remove.reset();
                            setDialog({ kind: "delete", row });
                          }}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                          O&apos;chirish
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
              category: query.category,
              dateFrom: query.dateFrom,
              dateTo: query.dateTo,
              page,
            })
          }
        />
      ) : null}

      {dialog?.kind === "create" ? (
        <ExpenseFormModal
          key="create"
          open
          onOpenChange={() => setDialog(null)}
          onDone={() => setDialog(null)}
        />
      ) : null}

      {dialog?.kind === "edit" ? (
        <ExpenseFormModal
          key={dialog.row.id}
          open
          onOpenChange={() => setDialog(null)}
          expense={dialog.row}
          onDone={() => setDialog(null)}
        />
      ) : null}

      <ConfirmModal
        open={dialog?.kind === "delete"}
        onOpenChange={() => setDialog(null)}
        title="Xarajat o'chirilsinmi?"
        subject={
          dialog?.kind === "delete"
            ? `${dialog.row.title} · ${formatSum(dialog.row.amount)}`
            : ""
        }
        warning="Xarajat butunlay o'chiriladi — buni orqaga qaytarib bo'lmaydi."
        confirmLabel="O'chirish"
        busy={remove.isPending}
        error={deleteError}
        onConfirm={() => {
          if (dialog?.kind === "delete") {
            remove.mutate({ id: dialog.row.id });
          }
        }}
      />
    </div>
  );
}
