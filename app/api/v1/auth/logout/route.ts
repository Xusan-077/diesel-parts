import { NextResponse } from "next/server";
import { backendRequest } from "@/lib/api/backend-client";
import { STAFF_SESSION_COOKIE, getStaffSession, staffCookieOptions } from "@/lib/auth/staff-session";

export async function POST() {
  const session = await getStaffSession();

  if (session) {
    try {
      // Revokes backend/'s refresh token server-side. Best-effort: whether or
      // not this succeeds, this app's own cookie is cleared below regardless —
      // a signed-out browser is the guarantee this route actually makes.
      await backendRequest("/auth/logout", { method: "POST", accessToken: session.accessToken });
    } catch {
      // Ignored — see comment above.
    }
  }

  const response = NextResponse.json({ success: true });
  // Same attributes as when it was set — a cookie only clears if they match.
  response.cookies.set(STAFF_SESSION_COOKIE, "", { ...staffCookieOptions, maxAge: 0 });
  return response;
}
