"use client";

import { useQuery } from "@tanstack/react-query";
import { adminKeys } from "@/lib/api/admin/keys";
import {
  createStaff,
  fetchStaff,
  updateStaff,
  type StaffListRow,
} from "@/lib/api/admin/resources";
import type { UserCreateInput, UserUpdateInput } from "@/lib/schemas";
import { PANEL_STALE_MS, usePanelMutation } from "./use-panel-mutation";

/** Every staff account, active and suspended together. */
export function useAdminStaff(initialData?: StaffListRow[]) {
  return useQuery({
    queryKey: adminKeys.staff.list(),
    queryFn: fetchStaff,
    initialData,
    staleTime: PANEL_STALE_MS,
  });
}

/*
 * Both writes are silent on failure: the two dialogs pin a refusal to the field
 * it belongs to — a taken email under the email box — and say their own piece
 * on success.
 */
export function useCreateStaff() {
  return usePanelMutation<UserCreateInput, { id: string }>({
    run: createStaff,
    invalidates: [adminKeys.staff.all, adminKeys.audit.all],
  });
}

export function useUpdateStaff() {
  return usePanelMutation<{ id: string; values: UserUpdateInput }, void>({
    run: ({ id, values }) => updateStaff(id, values),
    invalidates: [adminKeys.staff.all, adminKeys.audit.all],
  });
}

/**
 * Suspending an account, and lifting it again.
 *
 * A staff row cannot be deleted — `Order.sellerId` references it with
 * `Restrict`, so removing a seller who has ever closed a sale would either fail
 * or take the sale with it. Clearing `isActive` is the real action: it ends the
 * session and blocks the login while the sales history stays intact.
 *
 * The whole row is resent because the route takes a full update; sending only
 * the flag would blank the fields the schema requires.
 */
export function useSetStaffActive(onDone?: () => void) {
  return usePanelMutation<{ user: StaffListRow; isActive: boolean }, void>({
    run: ({ user, isActive }) =>
      updateStaff(user.id, {
        name: user.name,
        phone: user.phone,
        role: user.role,
        discountLimit: user.discountLimit,
        isActive,
      }),
    invalidates: [adminKeys.staff.all, adminKeys.audit.all],
    success: ({ isActive }) => (isActive ? "Hisob yoqildi" : "Hisob o'chirildi"),
    // No failure toast: the confirm dialog keeps the message inside itself.
    onDone,
  });
}
