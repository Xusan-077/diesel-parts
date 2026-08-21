import { SignJWT, jwtVerify } from "jose";
import { getSecret } from "./secret";
import type { StaffRole } from "./roles";

/**
 * A working day, against thirty days for a customer session. Staff sessions
 * carry a role, so a stolen one is worth far more; a shop-floor machine left
 * unlocked overnight should not still be signed in.
 */
export const STAFF_SESSION_TTL_SECONDS = 60 * 60 * 12;

/**
 * Customer and staff tokens are signed with the same key, so the audience is
 * what stops one being replayed as the other.
 */
const STAFF_AUDIENCE = "diesel-parts:staff";

export interface StaffSession {
  userId: string;
  role: StaffRole;
  name: string;
}

function isStaffRole(value: unknown): value is StaffRole {
  return value === "DIRECTOR" || value === "SELLER";
}

export async function createStaffToken(session: StaffSession): Promise<string> {
  return new SignJWT({ role: session.role, name: session.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.userId)
    .setAudience(STAFF_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${STAFF_SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

/**
 * Decodes the cookie only. It says what the token claimed at sign-in, not what
 * is true now: a role change or a deactivated account is invisible here. Every
 * server read must go through `requireStaff` in `lib/auth/dal.ts`, which reads
 * the user row.
 */
export async function verifyStaffToken(token: string): Promise<StaffSession | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"],
      audience: STAFF_AUDIENCE,
    });

    if (typeof payload.sub !== "string" || !isStaffRole(payload.role)) {
      return null;
    }

    return {
      userId: payload.sub,
      role: payload.role,
      name: typeof payload.name === "string" ? payload.name : "",
    };
  } catch {
    return null;
  }
}
