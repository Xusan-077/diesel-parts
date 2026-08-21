import "server-only";
import { cookies } from "next/headers";
import { STAFF_SESSION_COOKIE } from "./cookie-names";
import { STAFF_SESSION_TTL_SECONDS, verifyStaffToken, type StaffSession } from "./staff-token";

export { STAFF_SESSION_COOKIE } from "./cookie-names";

export const staffCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: STAFF_SESSION_TTL_SECONDS,
} as const;

/**
 * Reads what the cookie claims. Nothing here touches the database, so treat the
 * result as a hint: `getStaffUser` in `dal.ts` is what decides access.
 */
export async function getStaffSession(): Promise<StaffSession | null> {
  const token = (await cookies()).get(STAFF_SESSION_COOKIE)?.value;
  return token ? verifyStaffToken(token) : null;
}
