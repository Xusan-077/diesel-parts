import { NextResponse, type NextRequest } from "next/server";
import { STAFF_SESSION_COOKIE } from "@/lib/auth/cookie-names";
import {
  ADMIN_ROOT,
  STAFF_LOGIN_PATH,
  adminHomePath,
  canAccessAdminPath,
  isAdminPath,
  isDirectorPath,
} from "@/lib/auth/roles";
import { verifyStaffToken } from "@/lib/auth/staff-token";

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
 * An optimistic check only: it reads the cookie and never the database, because
 * proxy runs on every request including prefetches. It exists to keep signed-out
 * users off the panel and to send people somewhere sensible. The decision that
 * actually protects data is `requireStaff`/`requireDirector` in lib/auth/dal.ts,
 * which re-reads the user row.
 */
async function proxyAdmin(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(STAFF_SESSION_COOKIE)?.value;
  const session = token ? await verifyStaffToken(token) : null;

  // No login-path exemption here: the shared sign-in screen lives under
  // `/director` now (STAFF_LOGIN_PATH), not `/admin` — see proxyDirector.
  if (!session) {
    const url = new URL(STAFF_LOGIN_PATH, request.url);
    // Carried as a path, never a full URL, so it cannot become an open redirect.
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname === ADMIN_ROOT || !canAccessAdminPath(pathname, session.role)) {
    return NextResponse.redirect(new URL(adminHomePath(session.role), request.url));
  }

  return NextResponse.next();
}

/**
 * The director panel's own guard. Simpler than `proxyAdmin`'s in every way
 * but one: `/director` has no shared subtree a second role may open, so this
 * is "signed in, and a director" or it is a redirect — no area table to
 * consult. The one thing it shares with `proxyAdmin` is the login-path
 * exemption, because `STAFF_LOGIN_PATH` sits under this prefix
 * (`/director/login`) rather than under `/admin`.
 */
async function proxyDirector(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(STAFF_SESSION_COOKIE)?.value;
  const session = token ? await verifyStaffToken(token) : null;

  if (pathname === STAFF_LOGIN_PATH) {
    if (!session) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL(adminHomePath(session.role), request.url));
  }

  if (!session) {
    const url = new URL(STAFF_LOGIN_PATH, request.url);
    // Carried as a path, never a full URL, so it cannot become an open redirect.
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (session.role !== "DIRECTOR") {
    return NextResponse.redirect(new URL(adminHomePath(session.role), request.url));
  }

  return NextResponse.next();
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

  if (isAdminPath(pathname)) {
    return proxyAdmin(request);
  }

  if (isDirectorPath(pathname)) {
    return proxyDirector(request);
  }

  return NextResponse.next();
}
