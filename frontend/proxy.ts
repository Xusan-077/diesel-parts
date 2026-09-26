import { NextResponse, type NextRequest } from "next/server";
import { backendAuthRequest } from "@/lib/api/backend-client";
import { STAFF_SESSION_COOKIE } from "@/lib/auth/cookie-names";
import { PANEL_ROOT, STAFF_LOGIN_PATH } from "@/lib/auth/roles";
import {
  accessTokenExpiryMs,
  createStaffToken,
  staffCookieOptions,
  verifyStaffToken,
  type StaffSession,
} from "@/lib/auth/staff-token";

/**
 * Framework paths and files in `public/`, which no rule here applies to.
 *
 * This is a function rather than `config.matcher`. The documented regex form,
 * `/((?!_next|api|.*\..*).*)`, compiled on this Next.js version to something
 * that only ever matched `/`, which would have left the panel guard below dead
 * on every other path. Filtering in code costs one call per asset request and
 * can be tested.
 */
const SKIPPED = /^\/(?:_next|api)(?:\/|$)/;

export function isSkipped(pathname: string): boolean {
  // A dot means a file extension: `/favicon.ico`, `/og.png`, never a route.
  return SKIPPED.test(pathname) || pathname.includes(".");
}

/**
 * Refresh once less than this much of backend/'s access token life remains,
 * so the request in flight never races its own expiry mid-way through.
 */
const REFRESH_MARGIN_MS = 60_000;

export function needsRefresh(session: Pick<StaffSession, "accessTokenExpiresAt">, now = Date.now()): boolean {
  return session.accessTokenExpiresAt - now < REFRESH_MARGIN_MS;
}

interface BackendRefreshResponse {
  accessToken: string;
  user: { role: StaffSession["role"] };
}

/**
 * Calls backend/'s own `/auth/refresh` and mints a new outer session token.
 * `null` means the refresh token itself was invalid, expired or revoked —
 * the caller treats that exactly like "was never signed in", since there is
 * nothing left to retry with.
 */
async function refreshSession(session: StaffSession): Promise<{ session: StaffSession; token: string } | null> {
  try {
    const { data, refreshToken } = await backendAuthRequest<BackendRefreshResponse>("/auth/refresh", {
      method: "POST",
      refreshCookie: `refresh_token=${session.refreshToken}`,
    });

    if (!refreshToken) {
      // backend/ didn't rotate a cookie for us — treat as a failed refresh
      // rather than silently reusing a refresh token it may already have
      // revoked (backend/'s AuthService.refresh revokes on every use).
      return null;
    }

    const nextSession: StaffSession = {
      role: data.user.role,
      accessToken: data.accessToken,
      refreshToken,
      accessTokenExpiresAt: accessTokenExpiryMs(data.accessToken),
    };

    return { session: nextSession, token: await createStaffToken(nextSession) };
  } catch {
    return null;
  }
}

/**
 * Reads the session cookie and, if its access token is near expiry, refreshes
 * it against backend/ before this request's routing decision is made.
 * Middleware is the only place in this app allowed to rewrite the cookie for
 * a plain page navigation — Server Components can't mutate cookies during a
 * render (see lib/auth/dal.ts's `loadStaffUser`) — so this is also the only
 * place a proactive refresh can happen. `cookie` is non-null exactly when the
 * caller must apply it to whatever response it returns.
 */
async function resolveSession(
  request: NextRequest,
): Promise<{ session: StaffSession | null; cookie: string | null }> {
  const token = request.cookies.get(STAFF_SESSION_COOKIE)?.value;
  const session = token ? await verifyStaffToken(token) : null;

  if (!session || !needsRefresh(session)) {
    return { session, cookie: null };
  }

  const refreshed = await refreshSession(session);
  if (!refreshed) {
    return { session: null, cookie: null };
  }

  return { session: refreshed.session, cookie: refreshed.token };
}

function withCookie(response: NextResponse, cookie: string | null): NextResponse {
  if (cookie) {
    response.cookies.set(STAFF_SESSION_COOKIE, cookie, staffCookieOptions);
  }
  return response;
}

/**
 * An optimistic check only: it reads the cookie and never the database
 * (beyond the occasional refresh call above, which is backend/'s own token
 * service, not a data read), because proxy runs on every request including
 * prefetches. It exists to keep signed-out users off the panel and send them
 * to the login screen. The decision that actually protects data — both which
 * page a role may open and, within it, cost-sensitive fields — is
 * `requirePermission()`/`requireStaff()` in lib/auth/dal.ts, which re-reads
 * the user row via backend/'s own `/auth/me` on every render.
 *
 * Both roles share one home now (`/panel`) — unlike the old per-role
 * `adminHomePath` — so there is no per-role destination table left to consult
 * here. `next.config.ts`'s `redirects()` already turns the old `/admin`,
 * `/admin/seller/*` and `/director/*` URLs into `/panel` equivalents before
 * this ever runs (next.config redirects are applied before middleware), so
 * the only routing decision proxy itself makes is "signed in or not".
 */
async function proxyPanel(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const { session, cookie } = await resolveSession(request);

  if (!session) {
    const url = new URL(STAFF_LOGIN_PATH, request.url);
    // Carried as a path, never a full URL, so it cannot become an open redirect.
    url.searchParams.set("next", pathname);
    return withCookie(NextResponse.redirect(url), cookie);
  }

  return withCookie(NextResponse.next(), cookie);
}

/**
 * The login screen's own guard: a signed-in visitor is sent to the panel
 * rather than shown the form again. Everyone lands at the same `/panel` now,
 * so — unlike the old per-role `adminHomePath` — there is nothing left to
 * branch on here.
 */
async function proxyLogin(request: NextRequest): Promise<NextResponse> {
  const { session, cookie } = await resolveSession(request);

  if (!session) {
    return withCookie(NextResponse.next(), cookie);
  }
  return withCookie(NextResponse.redirect(new URL(PANEL_ROOT, request.url)), cookie);
}

/**
 * The panel guard is all that is left here. The locale redirect that used to
 * follow it is gone with the `[lang]` segment: the language is a cookie the
 * server components read, so no URL needs rewriting to carry it.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (isSkipped(pathname)) {
    return NextResponse.next();
  }

  if (pathname === STAFF_LOGIN_PATH) {
    return proxyLogin(request);
  }

  if (pathname === PANEL_ROOT || pathname.startsWith(`${PANEL_ROOT}/`)) {
    return proxyPanel(request);
  }

  return NextResponse.next();
}
