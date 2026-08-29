import { NextResponse } from "next/server";
import { staffLoginSchema } from "@/lib/schemas";
import { adminHomePath } from "@/lib/auth/roles";
import { BackendApiError, backendAuthRequest } from "@/lib/api/backend-client";
import { accessTokenExpiryMs, createStaffToken, type StaffSession } from "@/lib/auth/staff-token";
import { STAFF_SESSION_COOKIE, staffCookieOptions } from "@/lib/auth/staff-session";
import { recordAudit } from "@/lib/api/audit";

/** One message for every failure, so nothing distinguishes the causes. */
const INVALID_CREDENTIALS = "Email or password is incorrect.";

interface BackendLoginResponse {
  accessToken: string;
  user: { id: string; role: StaffSession["role"] };
}

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

  let login: { data: BackendLoginResponse; refreshToken: string | null };
  try {
    // The DTO field is named `phone` but accepts phone OR email (backend/'s
    // Task 1 kept the name to avoid an out-of-scope break to the seller
    // panel's own `{phone, password}` login body — see
    // backend/src/auth/dto/login.dto.ts). This form only ever collects an
    // email, matching root's own former email-only login.
    login = await backendAuthRequest<BackendLoginResponse>("/auth/login", {
      method: "POST",
      body: { phone: email, password: result.data.password },
    });
  } catch (error) {
    if (error instanceof BackendApiError && error.status === 429) {
      return NextResponse.json(
        { success: false, errors: { _root: ["Too many attempts. Try again later."] } },
        { status: 429 },
      );
    }
    // A deactivated account fails exactly like a wrong password (backend/'s
    // own behavior, ported from root's — see backend/src/auth/auth.service.ts):
    // a dismissed seller should not learn that their account still exists.
    return NextResponse.json(
      { success: false, errors: { _root: [INVALID_CREDENTIALS] } },
      { status: 401 },
    );
  }

  if (!login.refreshToken) {
    // backend/ didn't rotate a refresh cookie for us — treat this exactly
    // like a failed login rather than minting a session with no way to ever
    // refresh it (see backend-client.ts's backendAuthRequest doc comment).
    return NextResponse.json(
      { success: false, errors: { _root: [INVALID_CREDENTIALS] } },
      { status: 401 },
    );
  }

  const session: StaffSession = {
    role: login.data.user.role,
    accessToken: login.data.accessToken,
    refreshToken: login.refreshToken,
    accessTokenExpiresAt: accessTokenExpiryMs(login.data.accessToken),
  };
  const token = await createStaffToken(session);

  // TODO(backend-consolidation Part 4/5): still writes to root's own
  // AuditLog via @/lib/db (lib/api/audit.ts) — out of this task's scope
  // (see plan's file list for Task 14). Harmless today since a migrated
  // account's id is identical on both sides (the migration script copies
  // `id` verbatim); a staff account created directly in backend/ after this
  // point has no matching root User row, so this write will fail closed
  // (recordAudit never throws) until audit.ts is proxied to backend/'s own
  // AuditService (already built, Part 1 Task 4) ahead of deleting root's
  // Prisma layer.
  await recordAudit({
    userId: login.data.user.id,
    action: "LOGIN",
    entityType: "User",
    entityId: login.data.user.id,
  });

  const response = NextResponse.json({
    success: true,
    redirectTo: adminHomePath(session.role),
  });
  response.cookies.set(STAFF_SESSION_COOKIE, token, staffCookieOptions);
  return response;
}
