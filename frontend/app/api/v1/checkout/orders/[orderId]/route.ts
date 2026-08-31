import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { callBackendPhoneVerified } from "@/lib/api/internal-backend";
import { apiError } from "@/lib/api/route-auth";

interface CheckoutOrderStatus {
  orderNumber: string;
  status: string;
  paymentStatus: string;
  latestPaymentStatus: string | null;
}

/** Polled by CheckoutStatusClient after a Payme redirect — see that
 *  component for why this is a poll rather than a one-shot read. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return apiError(401, "Sign in to continue.");
  }

  const { orderId } = await params;
  const result = await callBackendPhoneVerified<CheckoutOrderStatus>(
    session.phone,
    `checkout/orders/${orderId}`,
  );

  return NextResponse.json({ success: true, ...result });
}
