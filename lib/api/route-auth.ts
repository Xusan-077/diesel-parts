import "server-only";
import { NextResponse } from "next/server";
import { getStaffUser, type StaffUser } from "@/lib/auth/dal";

/**
 * Route-handler counterpart to `requireStaff`/`requireDirector` in the DAL.
 * Pages redirect; an API has to answer with a status code, so the guard hands
 * back a ready-made response instead of navigating.
 */
export type StaffGuard =
  | { ok: true; user: StaffUser }
  | { ok: false; response: NextResponse };

export function apiError(status: number, message: string): NextResponse {
  return NextResponse.json({ success: false, errors: { _root: [message] } }, { status });
}

export async function authenticateStaff(): Promise<StaffGuard> {
  const user = await getStaffUser();

  if (!user) {
    return { ok: false, response: apiError(401, "Sign in to continue.") };
  }

  return { ok: true, user };
}

export async function authenticateDirector(): Promise<StaffGuard> {
  const guard = await authenticateStaff();

  if (!guard.ok) {
    return guard;
  }

  if (guard.user.role !== "DIRECTOR") {
    // 403, not 404: the seller is known, and hiding the route's existence buys
    // nothing when the panel navigation is the same code they already run.
    return { ok: false, response: apiError(403, "This action is for directors only.") };
  }

  return guard;
}
