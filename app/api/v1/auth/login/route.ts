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

  // The staff cookie recordAudit would otherwise read isn't set on this
  // request yet (that happens below), so the just-issued token is passed
  // in directly.
  await recordAudit({
    userId: login.data.user.id,
    action: "LOGIN",
    entityType: "User",
    entityId: login.data.user.id,
    accessToken: session.accessToken,
  });

  const response = NextResponse.json({
    success: true,
    redirectTo: adminHomePath(session.role),
  });
  response.cookies.set(STAFF_SESSION_COOKIE, token, staffCookieOptions);
  return response;
}
