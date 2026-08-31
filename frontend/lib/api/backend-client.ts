import "server-only";

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class BackendApiError extends Error {
  readonly status: number;
  readonly code: string;
  /**
   * The parsed JSON error body, when backend/ sent one. Structured refusals
   * (e.g. `insufficient_stock` carrying `productName`/`requested`/`available`)
   * put the fields a caller needs to map the failure here; `code` is just
   * `body.error`. `undefined` when the response had no JSON body.
   */
  readonly body?: unknown;

  constructor(message: string, status: number, code: string, body?: unknown) {
    super(message);
    this.name = "BackendApiError";
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  accessToken?: string;
  /** Raw Cookie header value to forward to backend's own refresh endpoint. */
  refreshCookie?: string;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(`${BACKEND_URL}/api${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function performRequest(path: string, options: RequestOptions): Promise<{ res: Response; data: unknown }> {
  const { method = "GET", body, query, accessToken, refreshCookie } = options;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (refreshCookie) headers.Cookie = refreshCookie;

  const res = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = res.status === 204 ? undefined : await res.json().catch(() => ({}));

  if (!res.ok) {
    const message = Array.isArray((data as { message?: unknown })?.message)
      ? (data as { message: string[] }).message.join(", ")
      : ((data as { message?: string })?.message ?? res.statusText);
    throw new BackendApiError(
      message,
      res.status,
      (data as { error?: string })?.error ?? String(res.status),
      data,
    );
  }

  return { res, data };
}

export async function backendRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { data } = await performRequest(path, options);
  return data as T;
}

/**
 * For the handful of backend/ endpoints that answer with a body that isn't
 * JSON at all — currently just `GET /products/export`'s CSV. `performRequest`
 * always calls `res.json()`, which throws on that body, so this issues its
 * own fetch rather than reusing it; every other request shape (headers,
 * error mapping) still matches `backendRequest`'s.
 */
export async function backendRequestText(path: string, options: RequestOptions = {}): Promise<string> {
  const { method = "GET", query, accessToken } = options;

  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(buildUrl(path, query), { method, headers });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new BackendApiError(text || res.statusText, res.status, String(res.status));
  }

  return res.text();
}

/**
 * `POST /auth/login` and `POST /auth/refresh` are the only backend/ endpoints
 * whose result includes a rotated refresh token — delivered only via a
 * `Set-Cookie: refresh_token=...` header (`backend/src/auth/auth.controller.ts`'s
 * `setRefreshCookie`), never in the JSON body. `backendRequest` discards
 * headers entirely; this sibling captures that one cookie's value for the
 * caller to store (this app's own session cookie, not a browser-facing one —
 * backend/'s cookie never reaches the browser in this flow).
 */
export async function backendAuthRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<{ data: T; refreshToken: string | null }> {
  const { res, data } = await performRequest(path, options);

  const refreshToken = res.headers
    .getSetCookie()
    .map((cookie) => /(?:^|;\s*)refresh_token=([^;]+)/.exec(cookie)?.[1])
    .find((value): value is string => value !== undefined);

  return { data: data as T, refreshToken: refreshToken ?? null };
}
