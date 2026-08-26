import axios, { AxiosError } from "axios";
import { useSellerAuthStore } from "@/lib/store/seller-auth-store";

/**
 * Browser-side client for the standalone NestJS backend (backend/), which
 * seller-panel routes (/seller/*, including /seller/login) talk to. Distinct
 * from
 * lib/api/client.ts, which hits this app's own Prisma-backed /api routes for
 * the storefront/admin — the two must never be mixed.
 */
const API_BASE = `${process.env.NEXT_PUBLIC_API_URL ?? ""}/api`;

const sellerAxios = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

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

function buildParams(query?: object): Record<string, string> | undefined {
  if (!query) return undefined;
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(query as Record<string, unknown>)) {
    if (value !== undefined && value !== "") {
      params[key] = String(value);
    }
  }
  return params;
}

function parseErrorBody(error: AxiosError): { message: string; code: string } {
  const data = error.response?.data as { message?: string | string[]; error?: string } | undefined;
  const message = Array.isArray(data?.message) ? data.message.join(", ") : data?.message;
  return {
    message: message ?? error.response?.statusText ?? error.message,
    code: data?.error ?? String(error.response?.status ?? 0),
  };
}

/** Coalesces concurrent 401s onto a single POST /auth/refresh call instead of a stampede. */
let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await sellerAxios.post<{
          accessToken: string;
          user: import("./types").AuthenticatedUser;
        }>("/auth/refresh");
        useSellerAuthStore.getState().setSession(res.data.accessToken, res.data.user);
        return res.data.accessToken;
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
    window.location.href = `/seller/login${next && next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`;
  }
}

export async function sellerApiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, skipAuthRetry } = options;
  const accessToken = useSellerAuthStore.getState().accessToken;

  try {
    const res = await sellerAxios.request<T>({
      url: path,
      method,
      params: buildParams(query),
      data: body,
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    });
    return res.status === 204 ? (undefined as T) : res.data;
  } catch (error) {
    if (!(error instanceof AxiosError)) {
      throw error;
    }
    const status = error.response?.status ?? 0;

    if (status === 401 && !skipAuthRetry && path !== "/auth/refresh") {
      const newToken = await refreshAccessToken();
      if (newToken) {
        return sellerApiRequest<T>(path, { ...options, skipAuthRetry: true });
      }
      redirectToLogin();
      throw new SellerApiError("Session expired", 401, "session_expired");
    }

    if (status === 403) {
      const { message } = parseErrorBody(error);
      throw new SellerApiError(message, 403, "forbidden");
    }

    const { message, code } = parseErrorBody(error);
    throw new SellerApiError(message, status, code);
  }
}
