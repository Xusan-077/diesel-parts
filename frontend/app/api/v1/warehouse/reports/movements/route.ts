import { NextResponse } from "next/server";
import { authenticateStaff, parseQuery } from "@/lib/api/route-auth";
import { listMovementsReport } from "@/lib/api/warehouse-repository";
import { movementsReportQuerySchema } from "@/lib/schemas";

/** The global stock ledger, filtered and paged — the movements report table. */
export async function GET(request: Request) {
  const guard = await authenticateStaff();
  if (!guard.ok) {
    return guard.response;
  }

  const query = parseQuery(request.url, movementsReportQuerySchema);
  if (!query.ok) {
    return query.response;
  }

  return NextResponse.json({ success: true, ...(await listMovementsReport(query.data)) });
}
