import "server-only";
import { cookies } from "next/headers";
import { STAFF_SESSION_COOKIE } from "./cookie-names";
import { verifyStaffToken, type StaffSession } from "./staff-token";

export { STAFF_SESSION_COOKIE } from "./cookie-names";
export { staffCookieOptions } from "./staff-token";

/**
 * Reads what the cookie claims. Nothing here touches the database, so treat the
 * result as a hint: `getStaffUser` in `dal.ts` is what decides access.
 */
export async function getStaffSession(): Promise<StaffSession | null> {
  const token = (await cookies()).get(STAFF_SESSION_COOKIE)?.value;
  return token ? verifyStaffToken(token) : null;
}
