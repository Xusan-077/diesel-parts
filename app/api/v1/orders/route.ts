import { NextResponse } from "next/server";
import { authenticateStaff, parseJsonBody, parseQuery } from "@/lib/api/route-auth";
import { createOrder, listOrders } from "@/lib/api/order-repository";
import { orderWriteError } from "@/lib/api/order-route-errors";
import { orderCreateSchema, orderListQuerySchema } from "@/lib/schemas";

/** A seller's own orders; every order for a director. */
export async function GET(request: Request) {
  const guard = await authenticateStaff();
  if (!guard.ok) {
    return guard.response;
  }

  const query = parseQuery(request.url, orderListQuerySchema);
  if (!query.ok) {
    return query.response;
  }

  return NextResponse.json({ success: true, ...(await listOrders(guard.user, query.data)) });
}

/**
 * Raises an order by hand, for a deal agreed on the phone.
 *
 * Line prices are snapshotted from the catalog rather than read from the body;
 * a price sent for a normally-priced product is ignored. It is required, and
 * only then, for products priced on request.
 */
export async function POST(request: Request) {
  const guard = await authenticateStaff();
  if (!guard.ok) {
    return guard.response;
  }

  const body = await parseJsonBody(request, orderCreateSchema);
  if (!body.ok) {
    return body.response;
  }

  const result = await createOrder(body.data, guard.user);

  if (!result.ok) {
    return orderWriteError(result);
  }

  return NextResponse.json({ success: true, id: result.id }, { status: 201 });
}
