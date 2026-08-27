import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { setCartItem } from "@/lib/api/cart-repository";
import { apiError, parseJsonBody } from "@/lib/api/route-auth";
import { cartSetItemSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return apiError(401, "Sign in to continue.");
  }

  const body = await parseJsonBody(request, cartSetItemSchema);
  if (!body.ok) {
    return body.response;
  }

  const cart = await setCartItem(session.phone, body.data.productId, body.data.quantity);
  return NextResponse.json({ success: true, items: cart.items });
}
