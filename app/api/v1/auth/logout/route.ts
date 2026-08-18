import { NextResponse } from "next/server";
import { STAFF_SESSION_COOKIE, staffCookieOptions } from "@/lib/auth/staff-session";

export async function POST() {
  const response = NextResponse.json({ success: true });
  // Same attributes as when it was set — a cookie only clears if they match.
  response.cookies.set(STAFF_SESSION_COOKIE, "", { ...staffCookieOptions, maxAge: 0 });
  return response;
}
