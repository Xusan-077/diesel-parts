import { NextResponse } from "next/server";
import { authenticateDirector, parseQuery } from "@/lib/api/route-auth";
import { financeWriteError } from "@/lib/api/finance-route-errors";
import { getFinanceSummary } from "@/lib/api/finance-repository";
import { financeSummaryQuerySchema } from "@/lib/schemas";

/** The finance KPI header — income, expense, net profit, debt. `DIRECTOR_UP`. */
export async function GET(request: Request) {
  const guard = await authenticateDirector();
  if (!guard.ok) {
    return guard.response;
  }

  const query = parseQuery(request.url, financeSummaryQuerySchema);
  if (!query.ok) {
    return query.response;
  }

  try {
    return NextResponse.json({ success: true, summary: await getFinanceSummary(query.data) });
  } catch (error) {
    return financeWriteError(error);
  }
}
