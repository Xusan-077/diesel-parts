import { SignJWT, jwtVerify } from "jose";

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

/**
 * Only used outside production so local development works with no setup.
 * `AUTH_SECRET` is mandatory in production — see getSecret below.
 */
const DEV_SECRET = "diesel-parts-development-only-secret-key";
const MIN_SECRET_LENGTH = 32;

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;

  if (secret && secret.length >= MIN_SECRET_LENGTH) {
    return new TextEncoder().encode(secret);
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      `AUTH_SECRET must be set to at least ${MIN_SECRET_LENGTH} characters in production.`
    );
  }

  return new TextEncoder().encode(DEV_SECRET);
}

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
