import { NextResponse } from "next/server";
import { authenticateDirector, parseJsonBody, parseQuery } from "@/lib/api/route-auth";
import { financeWriteError } from "@/lib/api/finance-route-errors";
import { createExpense, listFinanceExpenses } from "@/lib/api/finance-repository";
import { expenseWriteSchema, financeExpenseListQuerySchema } from "@/lib/schemas";

/** The expenses ledger. `DIRECTOR_UP`. */
export async function GET(request: Request) {
  const guard = await authenticateDirector();
  if (!guard.ok) {
    return guard.response;
  }

  const query = parseQuery(request.url, financeExpenseListQuerySchema);
  if (!query.ok) {
    return query.response;
  }

  try {
    return NextResponse.json({ success: true, ...(await listFinanceExpenses(query.data)) });
  } catch (error) {
    return financeWriteError(error);
  }
}

/** Records a new expense. */
export async function POST(request: Request) {
  const guard = await authenticateDirector();
  if (!guard.ok) {
    return guard.response;
  }

  const body = await parseJsonBody(request, expenseWriteSchema);
  if (!body.ok) {
    return body.response;
  }

  try {
    const expense = await createExpense(body.data);
    return NextResponse.json({ success: true, expense }, { status: 201 });
  } catch (error) {
    return financeWriteError(error);
  }
}
