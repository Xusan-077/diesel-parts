import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { callBackendPhoneVerified } from "@/lib/api/internal-backend";
import { apiError } from "@/lib/api/route-auth";

interface CartResult {
  items: { productId: string; quantity: number }[];
}

interface RouteContext {
  params: Promise<{ productId: string }>;
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session) {
    return apiError(401, "Sign in to continue.");
  }

  const { productId } = await params;
  const cart = await callBackendPhoneVerified<CartResult>(
    session.phone,
    `carts/items/${productId}`,
    { method: "DELETE" }
  );
  return NextResponse.json({ success: true, items: cart.items });
}
