import { NextResponse } from "next/server";
import { apiError, authenticateStaff, parseJsonBody } from "@/lib/api/route-auth";
import { getOrder, updateOrder } from "@/lib/api/order-repository";
import { orderWriteError } from "@/lib/api/order-route-errors";
import { orderUpdateSchema } from "@/lib/schemas";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await authenticateStaff();
  if (!guard.ok) {
    return guard.response;
  }

  const { id } = await params;
  const order = await getOrder(id, guard.user);

  if (order === null) {
    return apiError(404, "Buyurtma topilmadi.");
  }

  return NextResponse.json({ success: true, order });
}

/**
 * Moves the order along, re-lines it, or both.
 *
 * The legal moves are DRAFT → PENDING → CONFIRMED → COMPLETED, with CANCELLED
 * reachable from any of the three; anything else answers 409. Lines and notes
 * are editable in DRAFT and PENDING only — from CONFIRMED on, the order is the
 * record of an agreement.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await authenticateStaff();
  if (!guard.ok) {
    return guard.response;
  }

  const { id } = await params;

  const body = await parseJsonBody(request, orderUpdateSchema);
  if (!body.ok) {
    return body.response;
  }

  const result = await updateOrder(id, body.data, guard.user);

  if (!result.ok) {
    return orderWriteError(result);
  }

  return NextResponse.json({ success: true, id });
}
