/**
 * Who may enter which part of the staff panel.
 *
 * Pure and dependency-free on purpose: `proxy.ts`, the API route handlers and
 * the panel pages all have to agree on one answer, and a rule with no imports
 * can be unit-tested directly and reused from every runtime.
 */

export type StaffRole = "SUPER_ADMIN" | "DIRECTOR" | "MANAGER" | "SELLER" | "VIEWER";

export const ADMIN_ROOT = "/admin";

/**
 * The director panel's own root — a separate top-level app from `/admin`,
 * the way `/seller` already is, rather than a subtree of it. A director's
 * own pages (the dashboard, the catalogue, the audit log) have never been
 * reachable by a seller, so nesting them under the neutral `/admin` root
 * bought nothing; a seller's own pages still live at `/admin/seller`, and a
 * director still reaches those to support one — that cross-link is the one
 * reason `/admin` stays a real root rather than folding into `/director` too.
 */
export const DIRECTOR_ROOT = "/director";

/**
 * The one sign-in screen for both roles this file knows about (a seller has
 * a second, unrelated one — see lib/seller/safe-next.ts). It lives under
 * `/director` rather than `/admin` because a director is who most often
 * lands here; an admin-seller-role visitor still ends up at `/admin/seller`
 * after signing in, same as always, just by a login screen with a different
 * address. `app/director/login` is a sibling of the gated `(panel)` route
 * group, not a page inside it, so `requireDirector()` never runs against it.
 */
export const STAFF_LOGIN_PATH = "/director/login";

/**
 * Where a role lands after login, and where `/admin` and `/director` themselves
 * send them. `backend/`'s own API guards already treat SUPER_ADMIN and MANAGER
 * as director-or-above (`DIRECTOR_UP`/`MANAGER_UP`); this mirrors that at the
 * UI-gating level. VIEWER also lands here — read-only enforcement stays at the
 * API layer, since no page branches on it today.
 */
export function adminHomePath(role: StaffRole): string {
  return role === "SELLER" ? "/admin/seller" : DIRECTOR_ROOT;
}

/**
 * Roles allowed into each subtree of `/admin`. The director area is gone
 * from this table along with the pages themselves — see `isDirectorPath`.
 *
 * Default-deny: a path matching no entry is refused. Adding a page without
 * deciding who may see it then fails closed, rather than quietly opening it to
 * every seller.
 */
const ADMIN_AREAS: ReadonlyArray<{ prefix: string; roles: readonly StaffRole[] }> = [
  // A director-or-above may open the seller pages: supporting a seller means
  // seeing exactly what the seller sees.
  { prefix: "/admin/seller", roles: ["SELLER", "DIRECTOR", "MANAGER", "SUPER_ADMIN"] },
];

/** Strips a trailing slash so `/admin/seller/` and `/admin/seller` agree. */
function normalize(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

/** True when `pathname` is a segment-boundary match for `prefix`. */
function isUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isAdminPath(pathname: string): boolean {
  return isUnder(normalize(pathname), ADMIN_ROOT);
}

/** True for the director panel's own root and everything under it. */
export function isDirectorPath(pathname: string): boolean {
  return isUnder(normalize(pathname), DIRECTOR_ROOT);
}

export function canAccessAdminPath(pathname: string, role: StaffRole): boolean {
  const path = normalize(pathname);

  // `/admin` is a signed-in signpost that only forwards to the role's home.
  if (path === ADMIN_ROOT) {
    return true;
  }

  const area = ADMIN_AREAS.find((candidate) => isUnder(path, candidate.prefix));
  return area ? area.roles.includes(role) : false;
}

/**
 * Mirrors backend/'s own `DIRECTOR_UP` guard (SUPER_ADMIN, DIRECTOR, MANAGER)
 * — every backend/ endpoint gated that way (e.g. `/analytics/*`) throws a 403
 * for SELLER/VIEWER, so any root-side caller of one of those endpoints must
 * check this first rather than let the request reach backend/ and fail.
 */
export function isDirectorTier(role: StaffRole): boolean {
  return role === "SUPER_ADMIN" || role === "DIRECTOR" || role === "MANAGER";
}
