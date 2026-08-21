import { SignJWT, jwtVerify } from "jose";
import { getSecret } from "./secret";

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export interface Session {
  phone: string;
}

export async function createSessionToken(phone: string): Promise<string> {
  return new SignJWT({ phone })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(phone)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    return typeof payload.phone === "string" ? { phone: payload.phone } : null;
  } catch {
    return null;
  }
}
