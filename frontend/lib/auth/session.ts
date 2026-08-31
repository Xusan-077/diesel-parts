import { cookies } from "next/headers";
import { SESSION_TTL_SECONDS, verifySessionToken, type Session } from "./session-token";
import { PENDING_PHONE_COOKIE, SESSION_COOKIE } from "./cookie-names";

export { AUTH_HINT_COOKIE, PENDING_PHONE_COOKIE, SESSION_COOKIE } from "./cookie-names";

export const PENDING_PHONE_TTL_SECONDS = 10 * 60;

const baseCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
} as const;

export const sessionCookieOptions = {
  ...baseCookieOptions,
  maxAge: SESSION_TTL_SECONDS,
};

export const pendingPhoneCookieOptions = {
  ...baseCookieOptions,
  maxAge: PENDING_PHONE_TTL_SECONDS,
};

export const authHintCookieOptions = {
  ...baseCookieOptions,
  httpOnly: false,
  maxAge: SESSION_TTL_SECONDS,
};

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? verifySessionToken(token) : null;
}

export async function getPendingPhone(): Promise<string | null> {
  return (await cookies()).get(PENDING_PHONE_COOKIE)?.value ?? null;
}
