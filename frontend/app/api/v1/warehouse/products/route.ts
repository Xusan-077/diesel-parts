import { NextResponse } from "next/server";
import { authenticateStaff, parseQuery } from "@/lib/api/route-auth";
import { listWarehouseProducts } from "@/lib/api/warehouse-repository";
import { warehouseProductListQuerySchema } from "@/lib/schemas";

/**
 * The warehouse product table's rows, refetched by the browser as the search,
 * the status filter and the page change. Backend gates this `SELLER_UP`; this
 * route only checks the caller is signed-in staff and lets the backend decide.
 */
export async function GET(request: Request) {
  const guard = await authenticateStaff();
  if (!guard.ok) {
    return guard.response;
  }

  const query = parseQuery(request.url, warehouseProductListQuerySchema);
  if (!query.ok) {
    return query.response;
  }

  return NextResponse.json({ success: true, ...(await listWarehouseProducts(query.data)) });
}
