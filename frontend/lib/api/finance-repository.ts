import "server-only";
import { backendRequest } from "./backend-client";
import { getStaffSession } from "@/lib/auth/staff-session";
import type {
  DebtPaymentInput,
  ExpenseWriteInput,
  FinanceDebtListQuery,
  FinanceExpenseListQuery,
  FinancePaymentListQuery,
  FinanceSummaryQuery,
} from "@/lib/schemas";

/**
 * The director panel's window onto `backend/`'s finance module
 * (`backend/src/finance/**` — see
 * `docs/superpowers/specs/2026-09-09-finance-module-design.md`).
 *
 * Every call is a signed-in director's request and carries the staff
 * `accessToken`, the same way `warehouse-repository.ts` does. The finance
 * endpoints are `DIRECTOR_UP` on the backend.
 *
 * TODO(finance-backend): the `/finance/*` endpoints below do not exist yet.
 * Until they ship, every read here rejects and the page degrades through
 * `safeRead` to an empty state + a one-line notice (same as the warehouse
 * dashboard's fallback); the write helpers surface the transport error in the
 * modal that called them.
 */

export type {
  DebtStatusValue,
  ExpenseCategoryValue,
  PaymentMethodValue,
} from "@/lib/schemas";

import type { DebtStatusValue } from "@/lib/schemas";

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const EMPTY_META: PageMeta = { page: 1, pageSize: 20, total: 0, totalPages: 1 };

interface BackendMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function toMeta(meta: BackendMeta | undefined): PageMeta {
  if (!meta) return EMPTY_META;
  return { page: meta.page, pageSize: meta.limit, total: meta.total, totalPages: meta.totalPages };
}

async function accessToken(): Promise<string | undefined> {
  const session = await getStaffSession();
  return session?.accessToken;
}

/* ── Summary (KPI header) ────────────────────────────────────────────────── */

export interface FinanceSummary {
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  totalDebt: number;
  debtorCount: number;
}

export const EMPTY_SUMMARY: FinanceSummary = {
  totalIncome: 0,
  totalExpense: 0,
  netProfit: 0,
  totalDebt: 0,
  debtorCount: 0,
};

export async function getFinanceSummary(
  query: FinanceSummaryQuery,
): Promise<FinanceSummary> {
  const result = await backendRequest<Partial<FinanceSummary>>("/finance/summary", {
    accessToken: await accessToken(),
    query: { dateFrom: query.dateFrom, dateTo: query.dateTo },
  });

  const totalIncome = Number(result.totalIncome ?? 0);
  const totalExpense = Number(result.totalExpense ?? 0);
  return {
    totalIncome,
    totalExpense,
    netProfit: Number(result.netProfit ?? totalIncome - totalExpense),
    totalDebt: Number(result.totalDebt ?? 0),
    debtorCount: Number(result.debtorCount ?? 0),
  };
}

/* ── Payments (income ledger) ───────────────────────────────────────────── */

interface BackendPayment {
  id: string;
  amount: number | string;
  method: string;
  paidAt: string | null;
  order: { id: string; orderNumber: string } | null;
  customer: { id: string; name: string } | null;
}

export interface FinancePaymentRow {
  id: string;
  amount: number;
  method: string;
  paidAt: string | null;
  orderId: string | null;
  orderNumber: string;
  customerId: string | null;
  customerName: string;
}

export interface FinancePaymentPage {
  items: FinancePaymentRow[];
  meta: PageMeta;
}

function toPaymentRow(row: BackendPayment): FinancePaymentRow {
  return {
    id: row.id,
    amount: Number(row.amount),
    method: row.method,
    paidAt: row.paidAt,
    orderId: row.order?.id ?? null,
    orderNumber: row.order?.orderNumber ?? "—",
    customerId: row.customer?.id ?? null,
    customerName: row.customer?.name ?? "—",
  };
}

export async function listFinancePayments(
  query: FinancePaymentListQuery,
): Promise<FinancePaymentPage> {
  const result = await backendRequest<{ data: BackendPayment[]; meta: BackendMeta }>(
    "/finance/payments",
    {
      accessToken: await accessToken(),
      query: {
        q: query.q || undefined,
        method: query.method,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        page: query.page,
        limit: 20,
      },
    },
  );
  return { items: result.data.map(toPaymentRow), meta: toMeta(result.meta) };
}

/* ── Expenses ───────────────────────────────────────────────────────────── */

interface BackendExpense {
  id: string;
  title: string;
  category: string;
  amount: number | string;
  spentAt: string;
  note: string | null;
  createdBy: { id: string; name: string } | null;
  createdAt: string;
}

export interface ExpenseRow {
  id: string;
  title: string;
  category: string;
  amount: number;
  spentAt: string;
  note: string;
  createdByName: string;
  createdAt: string;
}

export interface ExpensePage {
  items: ExpenseRow[];
  meta: PageMeta;
}

function toExpenseRow(row: BackendExpense): ExpenseRow {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    amount: Number(row.amount),
    spentAt: row.spentAt,
    note: row.note ?? "",
    createdByName: row.createdBy?.name ?? "",
    createdAt: row.createdAt,
  };
}

export async function listFinanceExpenses(
  query: FinanceExpenseListQuery,
): Promise<ExpensePage> {
  const result = await backendRequest<{ data: BackendExpense[]; meta: BackendMeta }>(
    "/finance/expenses",
    {
      accessToken: await accessToken(),
      query: {
        q: query.q || undefined,
        category: query.category,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        page: query.page,
        limit: 20,
      },
    },
  );
  return { items: result.data.map(toExpenseRow), meta: toMeta(result.meta) };
}

function expenseBody(input: ExpenseWriteInput) {
  return {
    title: input.title,
    category: input.category,
    amount: input.amount,
    spentAt: input.spentAt,
    note: input.note || undefined,
  };
}

export async function createExpense(input: ExpenseWriteInput): Promise<ExpenseRow> {
  const row = await backendRequest<BackendExpense>("/finance/expenses", {
    method: "POST",
    accessToken: await accessToken(),
    body: expenseBody(input),
  });
  return toExpenseRow(row);
}

export async function updateExpense(
  id: string,
  input: ExpenseWriteInput,
): Promise<ExpenseRow> {
  const row = await backendRequest<BackendExpense>(`/finance/expenses/${id}`, {
    method: "PATCH",
    accessToken: await accessToken(),
    body: expenseBody(input),
  });
  return toExpenseRow(row);
}

export async function deleteExpense(id: string): Promise<void> {
  await backendRequest<{ success: true }>(`/finance/expenses/${id}`, {
    method: "DELETE",
    accessToken: await accessToken(),
  });
}

/* ── Debt ───────────────────────────────────────────────────────────────── */

interface BackendDebt {
  orderId: string;
  orderNumber: string;
  customer: { id: string; name: string; phone: string | null } | null;
  total: number | string;
  paid: number | string;
  remaining: number | string;
  status: DebtStatusValue;
  createdAt: string;
  lastPaymentAt: string | null;
}

export interface DebtRow {
  orderId: string;
  orderNumber: string;
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  total: number;
  paid: number;
  remaining: number;
  status: DebtStatusValue;
  createdAt: string;
  lastPaymentAt: string | null;
}

export interface DebtPage {
  items: DebtRow[];
  meta: PageMeta;
  totals: { remaining: number; count: number };
}

function toDebtRow(row: BackendDebt): DebtRow {
  return {
    orderId: row.orderId,
    orderNumber: row.orderNumber,
    customerId: row.customer?.id ?? null,
    customerName: row.customer?.name ?? "—",
    customerPhone: row.customer?.phone ?? "",
    total: Number(row.total),
    paid: Number(row.paid),
    remaining: Number(row.remaining),
    status: row.status,
    createdAt: row.createdAt,
    lastPaymentAt: row.lastPaymentAt,
  };
}

export async function listFinanceDebts(
  query: FinanceDebtListQuery,
): Promise<DebtPage> {
  const result = await backendRequest<{
    data: BackendDebt[];
    meta: BackendMeta;
    totals?: { remaining: number | string; count: number };
  }>("/finance/debts", {
    accessToken: await accessToken(),
    query: {
      q: query.q || undefined,
      status: query.status,
      page: query.page,
      limit: 20,
    },
  });

  return {
    items: result.data.map(toDebtRow),
    meta: toMeta(result.meta),
    totals: {
      remaining: Number(result.totals?.remaining ?? 0),
      count: Number(result.totals?.count ?? 0),
    },
  };
}

export async function recordDebtPayment(
  orderId: string,
  input: DebtPaymentInput,
): Promise<DebtRow> {
  const row = await backendRequest<BackendDebt>(
    `/finance/debts/${orderId}/payments`,
    {
      method: "POST",
      accessToken: await accessToken(),
      body: { amount: input.amount, method: input.method, paidAt: input.paidAt || undefined },
    },
  );
  return toDebtRow(row);
}
