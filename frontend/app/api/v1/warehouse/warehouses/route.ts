import { NextResponse } from "next/server";
import { authenticateStaff, parseJsonBody, parseQuery } from "@/lib/api/route-auth";
import { warehouseWriteError } from "@/lib/api/warehouse-route-errors";
import { createWarehouse, listWarehouses } from "@/lib/api/warehouse-repository";
import { warehouseListQuerySchema, warehouseWriteSchema } from "@/lib/schemas";

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

/** Opens a new warehouse. `MANAGER_UP` on the backend; a director clears it. */
export async function POST(request: Request) {
  const guard = await authenticateStaff();
  if (!guard.ok) {
    return guard.response;
  }

  const body = await parseJsonBody(request, warehouseWriteSchema);
  if (!body.ok) {
    return body.response;
  }

  try {
    const warehouse = await createWarehouse(body.data);
    return NextResponse.json({ success: true, warehouse }, { status: 201 });
  } catch (error) {
    return warehouseWriteError(error);
  }
}
