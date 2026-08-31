import { NextResponse } from "next/server";
import { deliverOtp } from "@/lib/auth/deliver-otp";
import { requestCode } from "@/lib/auth/otp-store";
import { toCanonicalPhone } from "@/lib/auth/phone";
import { PENDING_PHONE_COOKIE, pendingPhoneCookieOptions } from "@/lib/auth/session";
import { requestCodeSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = requestCodeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "invalid_phone" }, { status: 400 });
  }

  const phone = toCanonicalPhone(parsed.data.phone);
  if (!phone) {
    return NextResponse.json({ success: false, error: "invalid_phone" }, { status: 400 });
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

  const response = NextResponse.json({
    success: true,
    resendAfterSeconds: issued.resendAfterSeconds,
    // Undefined in production, so the field is absent from the payload there.
    devCode,
  });
  // The phone travels in an httpOnly cookie rather than the URL or the client.
  response.cookies.set(PENDING_PHONE_COOKIE, phone, pendingPhoneCookieOptions);
  return response;
}
