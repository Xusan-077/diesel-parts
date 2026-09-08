import { NextResponse } from "next/server";
import { authenticateStaff, parseQuery } from "@/lib/api/route-auth";
import { listWarehouses } from "@/lib/api/warehouse-repository";
import { warehouseListQuerySchema } from "@/lib/schemas";

/** Every warehouse, for the filter dropdowns and the warehouses page. */
export async function GET(request: Request) {
  const guard = await authenticateStaff();
  if (!guard.ok) {
    return guard.response;
  }

  const query = parseQuery(request.url, warehouseListQuerySchema);
  if (!query.ok) {
    return query.response;
  }

  return NextResponse.json({ success: true, warehouses: await listWarehouses(query.data.status) });
}
