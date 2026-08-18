import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/db";
import { staffLoginSchema } from "@/lib/schemas";
import { adminHomePath } from "@/lib/auth/roles";
import { createStaffToken } from "@/lib/auth/staff-token";
import { STAFF_SESSION_COOKIE, staffCookieOptions } from "@/lib/auth/staff-session";
import {
  checkLoginAllowed,
  clearLoginFailures,
  recordLoginFailure,
} from "@/lib/auth/login-throttle";
import { recordAudit } from "@/lib/api/audit";

/**
 * A valid bcrypt hash of a random string, compared against when the email is
 * unknown. Without it the "no such user" path returns in microseconds while the
 * "wrong password" path spends ~250ms hashing, and that gap alone tells an
 * attacker which addresses are real.
 */
const DECOY_HASH = "$2b$12$6gvGctBdWlx8s.vP9b2.DeCAF9xD0PMUuub6/SVzhHnYM/Mw812v6";

/** One message for every failure, so nothing distinguishes the causes. */
const INVALID_CREDENTIALS = "Email or password is incorrect.";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, errors: { _root: ["Invalid JSON body"] } },
      { status: 400 },
    );
  }

  const result = staffLoginSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { success: false, errors: result.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const email = result.data.email.trim().toLowerCase();

  const allowed = checkLoginAllowed(email);
  if (!allowed.ok) {
    return NextResponse.json(
      {
        success: false,
        errors: { _root: ["Too many attempts. Try again later."] },
        retryAfterSeconds: allowed.retryAfterSeconds,
      },
      { status: 429, headers: { "Retry-After": String(allowed.retryAfterSeconds) } },
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const passwordMatches = await compare(result.data.password, user?.passwordHash ?? DECOY_HASH);

  // A deactivated account fails exactly like a wrong password: a dismissed
  // seller should not learn that their account still exists.
  if (!user || !user.isActive || !passwordMatches) {
    recordLoginFailure(email);
    return NextResponse.json(
      { success: false, errors: { _root: [INVALID_CREDENTIALS] } },
      { status: 401 },
    );
  }

  clearLoginFailures(email);

  const token = await createStaffToken({ userId: user.id, role: user.role, name: user.name });
  await recordAudit({
    userId: user.id,
    action: "LOGIN",
    entityType: "User",
    entityId: user.id,
  });

  const response = NextResponse.json({
    success: true,
    user: { id: user.id, name: user.name, role: user.role },
    redirectTo: adminHomePath(user.role),
  });
  response.cookies.set(STAFF_SESSION_COOKIE, token, staffCookieOptions);
  return response;
}
