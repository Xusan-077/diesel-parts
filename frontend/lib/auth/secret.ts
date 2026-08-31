/**
 * The HMAC key behind every signed cookie in the app.
 *
 * Shared by the customer session and the staff session so there is one place
 * that decides what an acceptable secret is — two copies would eventually
 * disagree about the production guard.
 */

const MIN_SECRET_LENGTH = 32;

/**
 * Only used outside production so local development works with no setup.
 * `AUTH_SECRET` is mandatory in production.
 */
const DEV_SECRET = "diesel-parts-development-only-secret-key";

export function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;

  if (secret && secret.length >= MIN_SECRET_LENGTH) {
    return new TextEncoder().encode(secret);
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      `AUTH_SECRET must be set to at least ${MIN_SECRET_LENGTH} characters in production.`,
    );
  }

  return new TextEncoder().encode(DEV_SECRET);
}
