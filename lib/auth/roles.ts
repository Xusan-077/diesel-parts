/**
 * Who may enter which part of the staff panel.
 *
 * Pure and dependency-free on purpose: `proxy.ts`, the API route handlers and
 * the panel pages all have to agree on one answer, and a rule with no imports
 * can be unit-tested directly and reused from every runtime.
 */

export type StaffRole = "DIRECTOR" | "SELLER";

export const ADMIN_ROOT = "/admin";
export const ADMIN_LOGIN_PATH = "/admin/login";

/** Where a role lands after login, and where `/admin` itself sends them. */
export function adminHomePath(role: StaffRole): string {
  return role === "DIRECTOR" ? "/admin/director" : "/admin/seller";
}

/**
 * Roles allowed into each subtree.
 *
 * Default-deny: a path matching no entry is refused. Adding a page without
 * deciding who may see it then fails closed, rather than quietly opening it to
 * every seller.
 */
const ADMIN_AREAS: ReadonlyArray<{ prefix: string; roles: readonly StaffRole[] }> = [
  { prefix: "/admin/director", roles: ["DIRECTOR"] },
  // Directors may open the seller pages: supporting a seller means seeing
  // exactly what the seller sees.
  { prefix: "/admin/seller", roles: ["SELLER", "DIRECTOR"] },
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

export function canAccessAdminPath(pathname: string, role: StaffRole): boolean {
  const path = normalize(pathname);

  // `/admin` is a signed-in signpost that only forwards to the role's home.
  if (path === ADMIN_ROOT) {
    return true;
  }

  const area = ADMIN_AREAS.find((candidate) => isUnder(path, candidate.prefix));
  return area ? area.roles.includes(role) : false;
}
