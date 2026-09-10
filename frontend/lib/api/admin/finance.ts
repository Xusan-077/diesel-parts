import { panelClient } from "./client";
import type {
  DebtPaymentInput,
  ExpenseWriteInput,
  FinanceDebtListQuery,
  FinanceExpenseListQuery,
  FinancePaymentListQuery,
  FinanceSummaryQuery,
} from "@/lib/schemas";
import type {
  DebtPage,
  DebtRow,
  ExpensePage,
  ExpenseRow,
  FinancePaymentPage,
  FinanceSummary,
} from "@/lib/api/finance-repository";

/**
 * Every finance request the browser makes, typed once — the client-side
 * counterpart to `lib/api/finance-repository.ts` (the server's). Each hits an
 * `/api/v1/finance/*` route that authenticates and proxies to `backend/`.
 */

interface Envelope {
  success?: boolean;
}

export async function fetchFinanceSummary(
  query: FinanceSummaryQuery,
): Promise<FinanceSummary> {
  const { data } = await panelClient.get<{ summary: FinanceSummary } & Envelope>(
    "/finance/summary",
    { params: { dateFrom: query.dateFrom, dateTo: query.dateTo } },
  );
  return data.summary;
}

export async function fetchFinancePayments(
  query: FinancePaymentListQuery,
): Promise<FinancePaymentPage> {
  const { data } = await panelClient.get<FinancePaymentPage & Envelope>("/finance/payments", {
    params: {
      q: query.q || undefined,
      method: query.method,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      page: query.page,
    },
  });
  return { items: data.items, meta: data.meta };
}

export async function fetchFinanceExpenses(
  query: FinanceExpenseListQuery,
): Promise<ExpensePage> {
  const { data } = await panelClient.get<ExpensePage & Envelope>("/finance/expenses", {
    params: {
      q: query.q || undefined,
      category: query.category,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      page: query.page,
    },
  });
  return { items: data.items, meta: data.meta };
}

export async function createExpense(input: ExpenseWriteInput): Promise<ExpenseRow> {
  const { data } = await panelClient.post<{ expense: ExpenseRow } & Envelope>(
    "/finance/expenses",
    input,
  );
  return data.expense;
}

export async function updateExpense(
  id: string,
  input: ExpenseWriteInput,
): Promise<ExpenseRow> {
  const { data } = await panelClient.patch<{ expense: ExpenseRow } & Envelope>(
    `/finance/expenses/${id}`,
    input,
  );
  return data.expense;
}

export async function deleteExpense(id: string): Promise<void> {
  await panelClient.delete(`/finance/expenses/${id}`);
}

export async function fetchFinanceDebts(
  query: FinanceDebtListQuery,
): Promise<DebtPage> {
  const { data } = await panelClient.get<DebtPage & Envelope>("/finance/debts", {
    params: { q: query.q || undefined, status: query.status, page: query.page },
  });
  return { items: data.items, meta: data.meta, totals: data.totals };
}

export async function recordDebtPayment(
  orderId: string,
  input: DebtPaymentInput,
): Promise<DebtRow> {
  const { data } = await panelClient.post<{ debt: DebtRow } & Envelope>(
    `/finance/debts/${orderId}/payments`,
    input,
  );
  return data.debt;
}
