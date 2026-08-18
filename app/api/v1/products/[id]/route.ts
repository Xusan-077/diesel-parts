import { NextResponse } from "next/server";
import { authenticateDirector, apiError } from "@/lib/api/route-auth";
import { setProductActive, updateProduct } from "@/lib/api/product-write-repository";
import { productWriteSchema } from "@/lib/schemas";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await authenticateDirector();
  if (!guard.ok) {
    return guard.response;
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "Invalid JSON body");
  }

  const parsed = productWriteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, errors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const result = await updateProduct(id, parsed.data, guard.user.id);

  if (!result.ok) {
    if (result.reason === "not_found") {
      return apiError(404, "Mahsulot topilmadi.");
    }
    return result.reason === "duplicate"
      ? apiError(409, "Bu " + result.field + " allaqachon band.")
      : apiError(400, "Kategoriya yoki brend topilmadi.");
  }

  return NextResponse.json({ success: true, id });
}

/**
 * Retires the product rather than deleting the row: OrderItem references it with
 * Restrict, and an order has to keep meaning something after a part is dropped.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
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
