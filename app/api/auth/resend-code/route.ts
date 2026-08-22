import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { deliverOtp } from "@/lib/auth/deliver-otp";
import { requestCode } from "@/lib/auth/otp-store";
import { PENDING_PHONE_COOKIE } from "@/lib/auth/session";

/**
 * Re-issues a code for the number already held in the pending cookie, so the
 * phone never has to travel back to the browser to be resent.
 */
export async function POST() {
  const phone = (await cookies()).get(PENDING_PHONE_COOKIE)?.value;
  if (!phone) {
    return NextResponse.json({ success: false, error: "no_pending_request" }, { status: 400 });
  }

  const issued = requestCode(phone);
  if (!issued.ok) {
    return NextResponse.json(
      { success: false, error: issued.reason, retryAfterSeconds: issued.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(issued.retryAfterSeconds) } }
    );
  }

  const { delivered, devCode } = await deliverOtp(phone, issued.code);
  if (!delivered) {
    return NextResponse.json({ success: false, error: "delivery_failed" }, { status: 502 });
  }

  // `devCode` is undefined in production, so the field is absent there.
  return NextResponse.json({
    success: true,
    resendAfterSeconds: issued.resendAfterSeconds,
    devCode,
  });
}
