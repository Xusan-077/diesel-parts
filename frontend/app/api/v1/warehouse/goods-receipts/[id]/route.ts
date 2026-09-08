import { NextResponse } from "next/server";
import { authenticateStaff, parseJsonBody } from "@/lib/api/route-auth";
import { warehouseWriteError } from "@/lib/api/warehouse-route-errors";
import { getGoodsReceipt, updateGoodsReceipt } from "@/lib/api/warehouse-repository";
import { goodsReceiptWriteSchema } from "@/lib/schemas";

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
    return NextResponse.json({ success: true, receipt: await getGoodsReceipt(id) });
  } catch (error) {
    return warehouseWriteError(error);
  }
}

/** Edits a DRAFT receipt; the backend refuses once it is APPROVED. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await authenticateStaff();
  if (!guard.ok) {
    return guard.response;
  }

  const body = await parseJsonBody(request, goodsReceiptWriteSchema);
  if (!body.ok) {
    return body.response;
  }

  const { id } = await params;
  try {
    return NextResponse.json({ success: true, receipt: await updateGoodsReceipt(id, body.data) });
  } catch (error) {
    return warehouseWriteError(error);
  }
}
