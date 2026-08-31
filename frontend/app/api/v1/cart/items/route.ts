import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { callBackendPhoneVerified } from "@/lib/api/internal-backend";
import { apiError, parseJsonBody } from "@/lib/api/route-auth";
import { cartSetItemSchema } from "@/lib/schemas";

interface CartResult {
  items: { productId: string; quantity: number }[];
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) {
    return apiError(401, "Sign in to continue.");
  }

  const body = await parseJsonBody(request, cartSetItemSchema);
  if (!body.ok) {
    return body.response;
  }

  const cart = await callBackendPhoneVerified<CartResult>(session.phone, "carts/items", {
    method: "PUT",
    body: body.data,
  });
  return NextResponse.json({ success: true, items: cart.items });
}
