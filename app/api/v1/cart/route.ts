import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { clearCart, getCart } from "@/lib/api/cart-repository";
import { apiError } from "@/lib/api/route-auth";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return apiError(401, "Sign in to continue.");
  }

  const cart = await getCart(session.phone);
  return NextResponse.json({ success: true, items: cart.items });
}

export async function DELETE() {
  const session = await getSession();
  if (!session) {
    return apiError(401, "Sign in to continue.");
  }

  await clearCart(session.phone);
  return NextResponse.json({ success: true });
}
