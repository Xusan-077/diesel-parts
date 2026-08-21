import { NextResponse } from "next/server";
import { authenticateStaff, parseJsonBody } from "@/lib/api/route-auth";
import { requestOrderDiscount } from "@/lib/api/order-repository";
import { orderDiscountError } from "@/lib/api/order-route-errors";
import { discountRequestSchema } from "@/lib/schemas";

/**
 * Asks for a discount on an order.
 *
 * Inside the seller's own `discountLimit` the answer is immediate and the
 * response carries the new total. Above it, this creates the PENDING
 * `DiscountRequest` the director's existing queue answers, and the response
 * says so — the order keeps quoting the old total until the answer arrives.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await authenticateStaff();
  if (!guard.ok) {
    return guard.response;
  }

  const { id } = await params;

  const body = await parseJsonBody(request, discountRequestSchema);
  if (!body.ok) {
    return body.response;
  }

  const result = await requestOrderDiscount(id, body.data, guard.user);

  if (!result.ok) {
    return orderDiscountError(result);
  }

  return result.kind === "immediate"
    ? NextResponse.json({ success: true, kind: result.kind, totalAmount: result.totalAmount })
    : NextResponse.json(
        { success: true, kind: result.kind, requestId: result.requestId },
        { status: 201 },
      );
}
