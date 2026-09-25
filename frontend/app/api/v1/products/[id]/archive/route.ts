import { NextResponse } from "next/server";
import { authenticateDirector, apiError } from "@/lib/api/route-auth";
import { setProductActive } from "@/lib/api/product-write-repository";

/**
 * Retires the product rather than deleting the row: OrderItem references it with
 * Restrict, and an order has to keep meaning something after a part is dropped.
 * (This was `DELETE /products/[id]` until that verb became the real delete.)
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await authenticateDirector();
  if (!guard.ok) {
    return guard.response;
  }

  const { id } = await params;
  const result = await setProductActive(id, false, guard.user.id);

  if (!result.ok) {
    return apiError(404, "Mahsulot topilmadi.");
  }

  return NextResponse.json({ success: true, id });
}
