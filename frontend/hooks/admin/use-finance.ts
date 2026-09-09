"use client";

import { useQuery } from "@tanstack/react-query";
import { adminKeys } from "@/lib/api/admin/keys";
import {
  createExpense,
  deleteExpense,
  fetchFinanceDebts,
  fetchFinanceExpenses,
  fetchFinancePayments,
  fetchFinanceSummary,
  recordDebtPayment,
  updateExpense,
} from "@/lib/api/admin/finance";
import type {
  DebtPage,
  DebtRow,
  ExpensePage,
  ExpenseRow,
  FinancePaymentPage,
  FinanceSummary,
} from "@/lib/api/finance-repository";
import type {
  DebtPaymentInput,
  ExpenseWriteInput,
  FinanceDebtListQuery,
  FinanceExpenseListQuery,
  FinancePaymentListQuery,
  FinanceSummaryQuery,
} from "@/lib/schemas";
import { PANEL_STALE_MS, usePanelMutation } from "./use-panel-mutation";

/**
 * The finance module's hooks. Same shape as `use-warehouse`: the page reads
 * the first screen on the server and passes it as `initialData`, the key
 * carries the URL state, and `PANEL_STALE_MS` keeps the server seed alive on
 * mount.
 *
 * A write to an expense or a debt payment moves the KPI header, so both
 * invalidate `finance.all` — the prefix over the summary and every tab.
 */

export function useFinanceSummary(query: FinanceSummaryQuery, initialData?: FinanceSummary) {
  return useQuery({
    queryKey: adminKeys.finance.summary(query),
    queryFn: () => fetchFinanceSummary(query),
    initialData,
    staleTime: PANEL_STALE_MS,
  });
}

export function useFinancePayments(
  query: FinancePaymentListQuery,
  initialData?: FinancePaymentPage,
) {
  return useQuery({
    queryKey: adminKeys.finance.payments(query),
    queryFn: () => fetchFinancePayments(query),
    initialData,
    staleTime: PANEL_STALE_MS,
  });
}

export function useFinanceExpenses(
  query: FinanceExpenseListQuery,
  initialData?: ExpensePage,
) {
  return useQuery({
    queryKey: adminKeys.finance.expenses.list(query),
    queryFn: () => fetchFinanceExpenses(query),
    initialData,
    staleTime: PANEL_STALE_MS,
  });
}

export function useFinanceDebts(query: FinanceDebtListQuery, initialData?: DebtPage) {
  return useQuery({
    queryKey: adminKeys.finance.debts.list(query),
    queryFn: () => fetchFinanceDebts(query),
    initialData,
    staleTime: PANEL_STALE_MS,
  });
}

/*
 * The expense form pins field refusals and announces its own success, so
 * create/update carry no toast. Delete is a one-click confirm, so it does.
 */
export function useCreateExpense() {
  return usePanelMutation<ExpenseWriteInput, ExpenseRow>({
    run: createExpense,
    invalidates: [adminKeys.finance.all],
  });
}

export function useUpdateExpense() {
  return usePanelMutation<{ id: string; values: ExpenseWriteInput }, ExpenseRow>({
    run: ({ id, values }) => updateExpense(id, values),
    invalidates: [adminKeys.finance.all],
  });
}

export function useDeleteExpense(onDone?: () => void) {
  return usePanelMutation<{ id: string }, void>({
    run: ({ id }) => deleteExpense(id),
    invalidates: [adminKeys.finance.all],
    success: "Xarajat o'chirildi",
    onDone,
  });
}

export function useRecordDebtPayment(onDone?: () => void) {
  return usePanelMutation<{ orderId: string; values: DebtPaymentInput }, DebtRow>({
    run: ({ orderId, values }) => recordDebtPayment(orderId, values),
    invalidates: [adminKeys.finance.all],
    onDone,
  });
}
