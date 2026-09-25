import { NextResponse } from "next/server";
import { authenticateDirector, apiError } from "@/lib/api/route-auth";
import { checkProductDelete } from "@/lib/api/product-write-repository";

/** Whether the product can be permanently deleted, and the blockers if not. DIRECTOR only. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await authenticateDirector();
  if (!guard.ok) {
    return guard.response;
  }

  const { id } = await params;
  const check = await checkProductDelete(id);

  if (check === null) {
    return apiError(404, "Mahsulot topilmadi.");
  }

  return NextResponse.json({ success: true, ...check });
}
