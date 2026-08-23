import { useSellerAuthStore } from "@/lib/store/seller-auth-store";

/**
 * Browser-side client for the standalone NestJS backend (backend/), which
 * seller-panel routes (/login, /seller/*) talk to. Distinct from
 * lib/api/client.ts, which hits this app's own Prisma-backed /api routes for
 * the storefront/admin — the two must never be mixed.
 */
const API_BASE = `${process.env.NEXT_PUBLIC_API_URL ?? ""}/api`;

export class SellerApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "SellerApiError";
    this.status = status;
    this.code = code;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /**
   * `object` rather than `Record<string, ...>`: every *Query DTO in types.ts
   * is a plain interface with no index signature, and TS won't assign those
   * to a Record-shaped parameter. `object` accepts them as-is; the single
   * cast for iteration lives here instead of at every call site.
   */
  query?: object;
  /** Internal: skips the 401 refresh-and-retry dance (used by the refresh call itself). */
  skipAuthRetry?: boolean;
}

function buildUrl(path: string, query?: object): string {
  const url = new URL(`${API_BASE}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query as Record<string, unknown>)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

async function parseErrorBody(res: Response): Promise<{ message: string; code: string }> {
  try {
    const data = (await res.json()) as { message?: string | string[]; error?: string };
    const message = Array.isArray(data.message) ? data.message.join(", ") : data.message;
    return { message: message ?? res.statusText, code: data.error ?? String(res.status) };
  } catch {
    return { message: res.statusText, code: String(res.status) };
  }
}

/** Coalesces concurrent 401s onto a single POST /auth/refresh call instead of a stampede. */
let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(buildUrl("/auth/refresh"), {
          method: "POST",
          credentials: "include",
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { accessToken: string; user: import("./types").AuthenticatedUser };
        useSellerAuthStore.getState().setSession(data.accessToken, data.user);
        return data.accessToken;
      } catch {
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

function redirectToLogin() {
  useSellerAuthStore.getState().clear();
  if (typeof window !== "undefined") {
    const next = window.location.pathname + window.location.search;
    // A hard navigation, deliberately: this runs outside React (a plain
    // module, not a component) so useRouter() isn't available, and a full
    // reload is what actually clears the in-memory access token and the
    // TanStack Query cache rather than leaving stale authenticated data
    // behind a soft client-side transition.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/login${next && next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`;
  }
}

export async function sellerApiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, skipAuthRetry } = options;
  const accessToken = useSellerAuthStore.getState().accessToken;

  const res = await fetch(buildUrl(path, query), {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && !skipAuthRetry && path !== "/auth/refresh") {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return sellerApiRequest<T>(path, { ...options, skipAuthRetry: true });
    }
    redirectToLogin();
    throw new SellerApiError("Session expired", 401, "session_expired");
  }

  if (res.status === 403) {
    const { message } = await parseErrorBody(res);
    throw new SellerApiError(message, 403, "forbidden");
  }

  if (!res.ok) {
    const { message, code } = await parseErrorBody(res);
    throw new SellerApiError(message, res.status, code);
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}
