import { NextResponse } from "next/server";
import { authenticateStaff } from "@/lib/api/route-auth";
import { warehouseWriteError } from "@/lib/api/warehouse-route-errors";
import { approveGoodsReceipt } from "@/lib/api/warehouse-repository";

/** Approves a DRAFT receipt — the one action that moves stock, done in one
 *  transaction on the backend. */
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
    return NextResponse.json({ success: true, receipt: await approveGoodsReceipt(id) });
  } catch (error) {
    return warehouseWriteError(error);
  }
}
