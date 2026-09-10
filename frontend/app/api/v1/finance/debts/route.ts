import { NextResponse } from "next/server";
import { authenticateDirector, parseQuery } from "@/lib/api/route-auth";
import { financeWriteError } from "@/lib/api/finance-route-errors";
import { listFinanceDebts } from "@/lib/api/finance-repository";
import { financeDebtListQuerySchema } from "@/lib/schemas";

/** Orders taken on credit — total, paid, remaining. `DIRECTOR_UP`. */
export async function GET(request: Request) {
  const guard = await authenticateDirector();
  if (!guard.ok) {
    return guard.response;
  }

  const query = parseQuery(request.url, financeDebtListQuerySchema);
  if (!query.ok) {
    return query.response;
  }

  try {
    return NextResponse.json({ success: true, ...(await listFinanceDebts(query.data)) });
  } catch (error) {
    return financeWriteError(error);
  }
}
