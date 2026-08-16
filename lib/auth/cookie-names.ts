/**
 * Cookie names only. Kept apart from `session.ts` so client components can
 * import a name without pulling `next/headers` into the browser bundle.
 */

export const SESSION_COOKIE = "dp_session";

/** Holds the phone between the two login steps, so it stays out of the URL. */
export const PENDING_PHONE_COOKIE = "dp_pending_phone";

/**
 * Readable-by-JS flag that only says "a session exists". It carries no secret
 * and grants nothing: every protected read still verifies the httpOnly session
 * on the server. It exists so the header can pick between the login modal and
 * an account link without making every page dynamic.
 */
export const AUTH_HINT_COOKIE = "dp_auth";
