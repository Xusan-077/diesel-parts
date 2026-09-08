import { NextResponse } from "next/server";
import { authenticateStaff, parseJsonBody, parseQuery } from "@/lib/api/route-auth";
import { warehouseWriteError } from "@/lib/api/warehouse-route-errors";
import { createGoodsReceipt, listGoodsReceipts } from "@/lib/api/warehouse-repository";
import { goodsReceiptListQuerySchema, goodsReceiptWriteSchema } from "@/lib/schemas";

/** The goods-receipt list, refetched as the status filter, search and page change. */
export async function GET(request: Request) {
  const guard = await authenticateStaff();
  if (!guard.ok) {
    return guard.response;
  }

  const query = parseQuery(request.url, goodsReceiptListQuerySchema);
  if (!query.ok) {
    return query.response;
  }

  return NextResponse.json({ success: true, ...(await listGoodsReceipts(query.data)) });
}

/** Saves a new receipt as a DRAFT. Approval — the only thing that moves stock
 *  — is a separate call. `MANAGER_UP` on the backend; a director clears it. */
export async function POST(request: Request) {
  const guard = await authenticateStaff();
  if (!guard.ok) {
    return guard.response;
  }

  const body = await parseJsonBody(request, goodsReceiptWriteSchema);
  if (!body.ok) {
    return body.response;
  }

  try {
    const receipt = await createGoodsReceipt(body.data);
    return NextResponse.json({ success: true, receipt }, { status: 201 });
  } catch (error) {
    return warehouseWriteError(error);
  }
}
