import { NextResponse } from "next/server";
import { authenticateDirector, parseQuery } from "@/lib/api/route-auth";
import { financeWriteError } from "@/lib/api/finance-route-errors";
import { listFinancePayments } from "@/lib/api/finance-repository";
import { financePaymentListQuerySchema } from "@/lib/schemas";

/** The income ledger — completed customer payments. `DIRECTOR_UP`. */
export async function GET(request: Request) {
  const guard = await authenticateDirector();
  if (!guard.ok) {
    return guard.response;
  }

  const query = parseQuery(request.url, financePaymentListQuerySchema);
  if (!query.ok) {
    return query.response;
  }

  try {
    return NextResponse.json({ success: true, ...(await listFinancePayments(query.data)) });
  } catch (error) {
    return financeWriteError(error);
  }
}
