import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ADMIN_LOGIN_PATH, adminHomePath, type StaffRole } from "./roles";
import { getStaffSession } from "./staff-session";

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  /** Percent this user may discount without asking a director. */
  discountLimit: number;
}

/**
 * The one place that answers "who is making this request".
 *
 * The cookie is only a claim. This re-reads the user row every request so that
 * deactivating an account or demoting a director takes effect immediately,
 * instead of waiting out the twelve-hour token. `cache` keeps that to a single
 * query per request even when a page and several components all ask.
 */
export const getStaffUser = cache(async (): Promise<StaffUser | null> => {
  const session = await getStaffSession();

  if (!session) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, role: true, discountLimit: true, isActive: true },
  });

  if (!user || !user.isActive) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    discountLimit: user.discountLimit,
  };
});

/** For pages: returns the signed-in user, or sends them to the login screen. */
export async function requireStaff(): Promise<StaffUser> {
  const user = await getStaffUser();

  if (!user) {
    redirect(ADMIN_LOGIN_PATH);
  }

  return user;
}

/**
 * For director-only pages. A seller who reaches one is sent to their own home
 * rather than the login screen: they are signed in, just not permitted here,
 * and bouncing them to a login form would only look broken.
 */
export async function requireDirector(): Promise<StaffUser> {
  const user = await requireStaff();

  if (user.role !== "DIRECTOR") {
    redirect(adminHomePath(user.role));
  }

  return user;
}
