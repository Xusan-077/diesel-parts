import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { removeCartItem, setCartItem } from "@/lib/api/cart-repository";
import { apiError, parseJsonBody } from "@/lib/api/route-auth";

const quantitySchema = z.object({ quantity: z.number().int().min(1).max(99) });

interface RouteContext {
  params: Promise<{ productId: string }>;
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session) {
    return apiError(401, "Sign in to continue.");
  }

  const body = await parseJsonBody(request, quantitySchema);
  if (!body.ok) {
    return body.response;
  }

  const { productId } = await params;
  const cart = await setCartItem(session.phone, productId, body.data.quantity);
  return NextResponse.json({ success: true, items: cart.items });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session) {
    return apiError(401, "Sign in to continue.");
  }

  const { productId } = await params;
  const cart = await removeCartItem(session.phone, productId);
  return NextResponse.json({ success: true, items: cart.items });
}
