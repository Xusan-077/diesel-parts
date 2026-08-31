import "server-only";
import { BackendApiError, backendRequest } from "./backend-client";
import { getStaffSession } from "@/lib/auth/staff-session";
import type { UserCreateInput, UserUpdateInput } from "@/lib/schemas";
import type { StaffRole } from "@/lib/auth/roles";

export interface StaffRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: StaffRole;
  isActive: boolean;
  discountLimit: number;
  createdAt: Date;
  /** Completed orders this account has closed, so a director sees who is active. */
  completedOrders: number;
}

interface BackendStaffRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: StaffRole;
  isActive: boolean;
  discountLimit: number;
  createdAt: string;
  completedOrders: number;
}

async function accessToken(): Promise<string | undefined> {
  const session = await getStaffSession();
  return session?.accessToken;
}

export async function listStaff(): Promise<StaffRow[]> {
  const rows = await backendRequest<BackendStaffRow[]>("/users", { accessToken: await accessToken() });

  const staff = rows.map((row) => ({
    ...row,
    // `email` is nullable on the row (a phone-primary seller account may
    // have none); this page's own StaffRow always had one because this
    // repository's callers all populate it through the form below, which
    // requires it.
    email: row.email ?? "",
    createdAt: new Date(row.createdAt),
  }));

  // backend/'s own order is createdAt desc (it has no sort param); sorted
  // here to keep this page's original active-first, then-alphabetical order
  // rather than silently reordering it to newest-account-first.
  return staff.sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name));
}

export type UserWriteResult =
  | { ok: true; id: string }
  | { ok: false; reason: "duplicate_email" }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "last_director" };

/** `Cannot deactivate the last active director` is the one 409 that isn't a duplicate. */
const LAST_DIRECTOR_MESSAGE = "Cannot deactivate the last active director";

function writeFailure(error: unknown): UserWriteResult {
  if (error instanceof BackendApiError) {
    if (error.status === 404) {
      return { ok: false, reason: "not_found" };
    }
    if (error.status === 409) {
      return error.message === LAST_DIRECTOR_MESSAGE
        ? { ok: false, reason: "last_director" }
        : { ok: false, reason: "duplicate_email" };
    }
  }
  throw error;
}

export async function createStaff(
  input: UserCreateInput,
  _actorId: string,
): Promise<UserWriteResult> {
  try {
    const created = await backendRequest<{ id: string }>("/users", {
      method: "POST",
      accessToken: await accessToken(),
      body: {
        name: input.name,
        email: input.email.trim().toLowerCase(),
        phone: input.phone?.trim() || null,
        password: input.password,
        role: input.role,
        discountLimit: input.discountLimit,
      },
    });
    return { ok: true, id: created.id };
  } catch (error) {
    return writeFailure(error);
  }
}

export async function updateStaff(
  id: string,
  input: UserUpdateInput,
  _actorId: string,
): Promise<UserWriteResult> {
  try {
    await backendRequest(`/users/${id}`, {
      method: "PATCH",
      accessToken: await accessToken(),
      body: {
        name: input.name,
        phone: input.phone?.trim() || null,
        role: input.role,
        discountLimit: input.discountLimit,
        isActive: input.isActive,
      },
    });
    return { ok: true, id };
  } catch (error) {
    return writeFailure(error);
  }
}
