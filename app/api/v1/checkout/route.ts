import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { callBackendPhoneVerified } from "@/lib/api/internal-backend";
import { apiError, parseJsonBody } from "@/lib/api/route-auth";
import { checkoutRequestSchema } from "@/lib/schemas";

interface CheckoutResult {
  order: Record<string, unknown>;
  checkoutUrl: string | null;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return apiError(401, "Sign in to continue.");
  }

  const body = await parseJsonBody(request, checkoutRequestSchema);
  if (!body.ok) {
    return body.response;
  }

  const result = await callBackendPhoneVerified<CheckoutResult>(session.phone, "checkout", {
    method: "POST",
    body: { ...body.data, returnBaseUrl: process.env.NEXT_PUBLIC_SITE_URL },
  });

  return NextResponse.json({ success: true, ...result });
}
