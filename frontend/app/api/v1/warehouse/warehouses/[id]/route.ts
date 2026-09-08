import { NextResponse } from "next/server";
import { authenticateStaff, parseJsonBody } from "@/lib/api/route-auth";
import { warehouseWriteError } from "@/lib/api/warehouse-route-errors";
import { deleteWarehouse, getWarehouse, updateWarehouse } from "@/lib/api/warehouse-repository";
import { warehouseWriteSchema } from "@/lib/schemas";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await authenticateStaff();
  if (!guard.ok) {
    return guard.response;
  }

  const { id } = await params;
  try {
    return NextResponse.json({ success: true, warehouse: await getWarehouse(id) });
  } catch (error) {
    return warehouseWriteError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await authenticateStaff();
  if (!guard.ok) {
    return guard.response;
  }

  const body = await parseJsonBody(request, warehouseWriteSchema);
  if (!body.ok) {
    return body.response;
  }

  const { id } = await params;
  try {
    return NextResponse.json({ success: true, warehouse: await updateWarehouse(id, body.data) });
  } catch (error) {
    return warehouseWriteError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await authenticateStaff();
  if (!guard.ok) {
    return guard.response;
  }

  const { id } = await params;
  try {
    await deleteWarehouse(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return warehouseWriteError(error);
  }
}
