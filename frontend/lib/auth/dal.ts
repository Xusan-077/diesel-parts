import "server-only";
import { cache } from "react";
import { redirect, forbidden } from "next/navigation";
import { BackendApiError, backendRequest } from "@/lib/api/backend-client";
import { STAFF_LOGIN_PATH, type StaffRole } from "./roles";
import { can, type Permission } from "./permissions";
import { getStaffSession } from "./staff-session";

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  /** Percent this user may discount without asking a director. */
  discountLimit: number;
}

interface BackendMeResponse {
  id: string;
  name: string;
  email: string | null;
  role: StaffRole;
  discountLimit: number;
  isActive: boolean;
}

/**
 * The one place that answers "who is making this request".
 *
 * The cookie's role/name are only a hint (see staff-token.ts) — this calls
 * backend/'s own `/auth/me` every time so that deactivating an account or
 * changing a role takes effect immediately, instead of waiting out the
 * twelve-hour outer cookie. Uncached on purpose: `getStaffUser` below wraps
 * this in `cache()` for real callers; tests call this directly since a
 * zero-arg `cache()` would otherwise share one memoized result across every
 * case in a run.
 */
export async function loadStaffUser(): Promise<StaffUser | null> {
  const session = await getStaffSession();

  if (!session) {
    return null;
  }

  let me: BackendMeResponse;
  try {
    me = await backendRequest<BackendMeResponse>("/auth/me", { accessToken: session.accessToken });
  } catch (error) {
    if (error instanceof BackendApiError && error.status === 401) {
      // The access token expired between proxy.ts's proactive refresh and
      // this render, or this request never passed through middleware. Next.js
      // forbids setting cookies from a render, so re-minting the session here
      // isn't possible — this degrades to signed-out; proxy.ts keeps this
      // path cold in the common case by refreshing before the token expires.
      return null;
    }
    throw error;
  }

  if (!me.isActive) {
    return null;
  }

  return {
    id: me.id,
    name: me.name,
    email: me.email ?? "",
    role: me.role,
    discountLimit: me.discountLimit,
  };
}

/** `cache` keeps this to a single `/auth/me` call per request even when a page and several components all ask. */
export const getStaffUser = cache(loadStaffUser);

/** For pages: returns the signed-in user, or sends them to the login screen. */
export async function requireStaff(): Promise<StaffUser> {
  const user = await getStaffUser();

  if (!user) {
    redirect(STAFF_LOGIN_PATH);
  }

  return user;
}

/**
 * For a page gated behind a specific permission. A SELLER hitting a
 * director-only page (finance, analytics, users, audit — or anything else
 * `can()` denies them) gets Next's `forbidden()` boundary, not a redirect:
 * they're signed in and the URL is real, so a 403 reads truer than either a
 * login bounce or a silent redirect to their own home.
 */
export async function requirePermission(permission: Permission): Promise<StaffUser> {
  const user = await requireStaff();

  if (!can(user.role, permission)) {
    forbidden();
  }

  return user;
}
