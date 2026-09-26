/**
 * Who may enter the staff panel.
 *
 * `StaffRole` mirrors backend/'s Prisma `Role` enum. Kept as a hand-written
 * union rather than generated, since this file has no Prisma dependency;
 * both sides changing together is enforced by the migration in
 * docs/superpowers/plans/2026-09-26-role-simplification-director-seller.md,
 * not by a type import. Per-page/per-route access is decided by `can()` in
 * permissions.ts, not by this file — `PANEL_ROOT`/`STAFF_LOGIN_PATH` are just
 * the two fixed addresses everything else in the panel refers back to.
 */
export type StaffRole = "DIRECTOR" | "SELLER";

/**
 * The one sign-in screen for both roles. It lives under `/director` rather
 * than under the merged panel itself so it can stay reachable with no
 * session at all — `app/director/login` is a standalone route, never nested
 * under `/panel`'s auth-gated layout.
 */
export const STAFF_LOGIN_PATH = "/director/login";

/** The merged panel root — both roles land here after login; `requirePermission()` narrows further per page. */
export const PANEL_ROOT = "/panel";
