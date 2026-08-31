import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { callBackendPhoneVerified } from "@/lib/api/internal-backend";
import { apiError } from "@/lib/api/route-auth";

interface CartResult {
  items: { productId: string; quantity: number }[];
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return apiError(401, "Sign in to continue.");
  }

  const cart = await callBackendPhoneVerified<CartResult>(session.phone, "carts");
  return NextResponse.json({ success: true, items: cart.items });
}

export async function DELETE() {
  const session = await getSession();
  if (!session) {
    return apiError(401, "Sign in to continue.");
  }

  await callBackendPhoneVerified(session.phone, "carts", { method: "DELETE" });
  return NextResponse.json({ success: true });
}
