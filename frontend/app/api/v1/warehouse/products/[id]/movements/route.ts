import { NextResponse } from "next/server";
import { authenticateStaff, parseQuery } from "@/lib/api/route-auth";
import { listProductMovements } from "@/lib/api/warehouse-repository";
import { productMovementsQuerySchema } from "@/lib/schemas";

/** One product's stock ledger, paged — the detail page's history table. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await authenticateStaff();
  if (!guard.ok) {
    return guard.response;
  }

  const query = parseQuery(request.url, productMovementsQuerySchema);
  if (!query.ok) {
    return query.response;
  }

  const { id } = await params;
  return NextResponse.json({
    success: true,
    ...(await listProductMovements(id, query.data)),
  });
}
