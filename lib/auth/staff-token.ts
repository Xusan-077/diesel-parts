import { SignJWT, decodeJwt, jwtVerify } from "jose";
import { getSecret } from "./secret";
import type { StaffRole } from "./roles";

/**
 * A working day, against thirty days for a customer session. Staff sessions
 * carry backend/'s own token pair, so a stolen one is worth far more; a
 * shop-floor machine left unlocked overnight should not still be signed in.
 * backend/'s own refresh token typically outlives this anyway (7d default),
 * so this outer TTL is usually what actually ends an idle session.
 */
export const STAFF_SESSION_TTL_SECONDS = 60 * 60 * 12;

/**
 * Lives here rather than in staff-session.ts (which imports `next/headers`,
 * unusable in `proxy.ts`'s middleware bundle) since middleware needs this to
 * re-mint the cookie itself on a proactive refresh.
 */
export const staffCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: STAFF_SESSION_TTL_SECONDS,
} as const;

/**
 * Customer and staff tokens are signed with the same key, so the audience is
 * what stops one being replayed as the other.
 */
const STAFF_AUDIENCE = "diesel-parts:staff";

/**
 * What the outer, root-signed cookie carries. `accessToken`/`refreshToken`
 * are backend/'s own tokens, opaque to this app — `role` is copied in at
 * login/refresh time purely so `proxy.ts` can make its optimistic routing
 * decision without a network call, matching its existing "never the
 * database" design (the copy is a hint the same way the old role-only
 * payload was; `getStaffUser` in dal.ts is still what actually authorizes,
 * via backend/'s own `/auth/me`). No `name`: backend/'s login/refresh
 * responses don't return one (only `/auth/me` does), and nothing reads it
 * off this session — `getStaffUser`'s own `/auth/me` call is the one place
 * a display name comes from.
 */
export interface StaffSession {
  role: StaffRole;
  accessToken: string;
  refreshToken: string;
  /** Unix ms — decoded from accessToken's own `exp` claim, not verified (see accessTokenExpiryMs). */
  accessTokenExpiresAt: number;
}

const STAFF_ROLES: readonly StaffRole[] = ["SUPER_ADMIN", "DIRECTOR", "MANAGER", "SELLER", "VIEWER"];

function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === "string" && (STAFF_ROLES as readonly string[]).includes(value);
}

/**
 * Reads backend/'s access token's own `exp` claim without verifying its
 * signature — this app has no reason to trust the claim for authorization
 * (backend/ itself does that on every `/auth/me` call), only to know roughly
 * when to refresh. A token that fails to decode is treated as already
 * expired, so a refresh is attempted rather than silently skipped.
 */
export function accessTokenExpiryMs(accessToken: string): number {
  try {
    const { exp } = decodeJwt(accessToken);
    return typeof exp === "number" ? exp * 1000 : Date.now();
  } catch {
    return Date.now();
  }
}

export async function createStaffToken(session: StaffSession): Promise<string> {
  return new SignJWT({
    role: session.role,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    accessTokenExpiresAt: session.accessTokenExpiresAt,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(STAFF_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${STAFF_SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

/**
 * Decodes the cookie only. It says what was true at the last login or
 * refresh, not what is true now: a role change or a deactivated account is
 * invisible here. Every server read must go through `getStaffUser` in
 * `lib/auth/dal.ts`, which calls backend/'s own `/auth/me`.
 */
export async function verifyStaffToken(token: string): Promise<StaffSession | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"],
      audience: STAFF_AUDIENCE,
    });

    if (
      !isStaffRole(payload.role) ||
      typeof payload.accessToken !== "string" ||
      typeof payload.refreshToken !== "string" ||
      typeof payload.accessTokenExpiresAt !== "number"
    ) {
      return null;
    }

    return {
      role: payload.role,
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
      accessTokenExpiresAt: payload.accessTokenExpiresAt,
    };
  } catch {
    return null;
  }
}
