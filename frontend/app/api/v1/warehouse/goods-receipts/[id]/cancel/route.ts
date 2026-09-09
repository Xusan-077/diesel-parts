import { NextResponse } from "next/server";
import { authenticateStaff } from "@/lib/api/route-auth";
import { warehouseWriteError } from "@/lib/api/warehouse-route-errors";
import { cancelGoodsReceipt } from "@/lib/api/warehouse-repository";

/** Cancels a DRAFT receipt. No stock has moved yet, so this only flips status. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await authenticateStaff();
  if (!guard.ok) {
    return guard.response;
  }

  const { id } = await params;
  try {
    return NextResponse.json({ success: true, receipt: await cancelGoodsReceipt(id) });
  } catch (error) {
    return warehouseWriteError(error);
  }
}
