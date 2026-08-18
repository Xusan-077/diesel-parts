import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/locales";
import { STAFF_SESSION_COOKIE } from "@/lib/auth/cookie-names";
import {
  ADMIN_LOGIN_PATH,
  ADMIN_ROOT,
  adminHomePath,
  canAccessAdminPath,
  isAdminPath,
} from "@/lib/auth/roles";
import { verifyStaffToken } from "@/lib/auth/staff-token";

/**
 * Framework paths and files in `public/`, which no rule here applies to.
 *
 * This is a function rather than `config.matcher`. The documented regex form,
 * `/((?!_next|api|.*\..*).*)`, compiled on this Next.js version to something
 * that only ever matched `/`: the locale redirect below was silently dead on
 * every other path, and the panel guard would have been too. Filtering in code
 * costs one call per asset request and can be tested.
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

  if (pathname === ADMIN_LOGIN_PATH) {
    if (!session) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL(adminHomePath(session.role), request.url));
  }

  if (!session) {
    const url = new URL(ADMIN_LOGIN_PATH, request.url);
    // Carried as a path, never a full URL, so it cannot become an open redirect.
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname === ADMIN_ROOT || !canAccessAdminPath(pathname, session.role)) {
    return NextResponse.redirect(new URL(adminHomePath(session.role), request.url));
  }

  return NextResponse.next();
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (isSkipped(pathname)) {
    return NextResponse.next();
  }

  // The staff panel is Uzbek-only and sits outside the [lang] segment, so it
  // must be answered before the locale redirect claims the path.
  if (isAdminPath(pathname)) {
    return proxyAdmin(request);
  }

  const firstSegment = pathname.split("/")[1] ?? "";

  if (isLocale(firstSegment)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = `/${DEFAULT_LOCALE}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}
