import "server-only";
import { createHmac } from "node:crypto";

/**
 * Signed server-to-server calls from this app to `backend/` (NestJS, on
 * Railway) — currently just the product "AI bilan" endpoints. The two
 * services run against separate databases and separate auth systems (see
 * `AiController`'s doc comment on the backend side), so a director's session
 * here carries no credential the backend would recognize; this proves
 * instead that the call really came from this server, and the caller's own
 * `authenticateDirector()` check is what already authorized the request.
 *
 * The signing scheme mirrors backend's `InternalRequestGuard`, itself a
 * generalization of `InternalServiceGuard`'s HMAC-over-timestamp pattern.
 */

export class InternalBackendError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "InternalBackendError";
    this.status = status;
  }
}

function sign(timestamp: string): string {
  const secret = process.env.INTERNAL_SERVICE_SECRET;
  if (!secret) {
    throw new Error("INTERNAL_SERVICE_SECRET is not set");
  }
  return createHmac("sha256", secret).update(`internal-request:${timestamp}`).digest("hex");
}

/** Posts JSON to `backend/`'s `POST /api/internal/products/<path>` and returns the parsed body. */
export async function callBackendInternal<T>(path: "ai-fill" | "ai-generate-image", body: unknown): Promise<T> {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) {
    throw new Error("NEXT_PUBLIC_API_URL is not set");
  }

  const timestamp = String(Date.now());

  const response = await fetch(base + "/api/internal/products/" + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-service-timestamp": timestamp,
      "x-service-signature": sign(timestamp),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new InternalBackendError(text || response.statusText, response.status);
  }

  return (await response.json()) as T;
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
 * not `internal-request:timestamp` — a different signature shape from
 * `callBackendInternal` above, matching the reviews module's existing
 * InternalServiceGuard-gated routes.
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
