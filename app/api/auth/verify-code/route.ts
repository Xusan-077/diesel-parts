import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifyCode } from "@/lib/auth/otp-store";
import {
  AUTH_HINT_COOKIE,
  PENDING_PHONE_COOKIE,
  SESSION_COOKIE,
  authHintCookieOptions,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { createSessionToken } from "@/lib/auth/session-token";
import { mergeGuestCart } from "@/lib/api/cart-repository";
import { verifyCodeWithCartSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = verifyCodeWithCartSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "invalid_code" }, { status: 400 });
  }

  // The phone comes from the httpOnly cookie, never from the request body, so a
  // caller cannot verify a code against someone else's number.
  const phone = (await cookies()).get(PENDING_PHONE_COOKIE)?.value;
  if (!phone) {
    return NextResponse.json({ success: false, error: "no_pending_request" }, { status: 400 });
  }

  const result = verifyCode(phone, parsed.data.code);
  if (!result.ok) {
    return NextResponse.json(
      {
        success: false,
        error: result.reason,
        ...(result.reason === "invalid" ? { attemptsLeft: result.attemptsLeft } : {}),
      },
      { status: result.reason === "too_many_attempts" ? 429 : 400 }
    );
  }

  const cart = await mergeGuestCart(phone, parsed.data.cart?.items ?? []);

  const response = NextResponse.json({ success: true, cart });
  response.cookies.set(SESSION_COOKIE, await createSessionToken(phone), sessionCookieOptions);
  response.cookies.set(AUTH_HINT_COOKIE, "1", authHintCookieOptions);
  response.cookies.delete(PENDING_PHONE_COOKIE);
  return response;
}
