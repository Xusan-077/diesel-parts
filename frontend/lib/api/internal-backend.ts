import "server-only";
import { createHmac } from "node:crypto";

/**
 * Signed server-to-server calls from this app to `backend/` (NestJS, on
 * Railway) for a storefront visitor whose phone this server already verified
 * by OTP. The backend has no session for that visitor, so the HMAC proves the
 * phone claim came from this server — see `InternalServiceGuard`.
 */

export class InternalBackendError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "InternalBackendError";
    this.status = status;
  }
}

function signWithPhone(phone: string, timestamp: string): string {
  const secret = process.env.INTERNAL_SERVICE_SECRET;
  if (!secret) {
    throw new Error("INTERNAL_SERVICE_SECRET is not set");
  }
  return createHmac("sha256", secret).update(`${phone}:${timestamp}`).digest("hex");
}

/**
 * Calls `backend/`'s phone-verified endpoints (currently just `carts/*`),
 * signing the way `InternalServiceGuard` expects: an HMAC over `phone:timestamp`,
 * matching the reviews module's existing InternalServiceGuard-gated routes.
 */
export async function callBackendPhoneVerified<T>(
  phone: string,
  path: string,
  options: { method?: "GET" | "PUT" | "POST" | "DELETE"; body?: unknown } = {},
): Promise<T> {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) {
    throw new Error("NEXT_PUBLIC_API_URL is not set");
  }

  const timestamp = String(Date.now());

  const response = await fetch(base + "/api/" + path, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      "x-verified-phone": phone,
      "x-service-timestamp": timestamp,
      "x-service-signature": signWithPhone(phone, timestamp),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new InternalBackendError(text || response.statusText, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
