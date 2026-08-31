"use client";

import { useQuery } from "@tanstack/react-query";
import { adminKeys } from "@/lib/api/admin/keys";
import {
  createCategory,
  deleteCategory,
  fetchCategories,
  updateCategory,
} from "@/lib/api/admin/resources";
import type { CatalogAdminRow } from "@/lib/api/catalog-repository";
import type { CategoryWriteInput } from "@/lib/schemas";
import { PANEL_STALE_MS, usePanelMutation } from "./use-panel-mutation";

/**
 * The whole catalogue tree, flat, in menu order.
 *
 * One key with no parameters: this list has no paging and no filter, because
 * the tree is what is being edited and half of it is not a tree. Every write
 * below invalidates exactly this.
 */
export function useAdminCategories(initialData?: CatalogAdminRow[]) {
  return useQuery({
    queryKey: adminKeys.categories.list(),
    queryFn: fetchCategories,
    initialData,
    staleTime: PANEL_STALE_MS,
  });
}

/*
 * All three writes stay silent on failure. The dialogs that call them keep the
 * message inside themselves — a rejected slug belongs next to the slug box,
 * and a category that cannot be deleted has to explain why in the dialog that
 * asked, not in a toast behind it.
 *
 * Every one of them also invalidates the public catalog menu, which is the
 * same tree read by `/api/catalog` and cached in every open tab's header. A
 * renamed column that kept its old name in the navigation until the next full
 * reload is exactly the drift this replaces.
 */
const CATEGORY_INVALIDATES = [
  adminKeys.categories.all,
  adminKeys.audit.all,
  ["catalog-tree"],
] as const;

export function useCreateCategory(onDone?: () => void) {
  return usePanelMutation<CategoryWriteInput, { id: string }>({
    run: createCategory,
    invalidates: CATEGORY_INVALIDATES,
    success: "Kategoriya qo'shildi",
    onDone,
  });
}

export function useUpdateCategory(onDone?: () => void) {
  return usePanelMutation<{ id: string; values: CategoryWriteInput }, void>({
    run: ({ id, values }) => updateCategory(id, values),
    invalidates: CATEGORY_INVALIDATES,
    success: "Kategoriya saqlandi",
    onDone,
  });
}

export function useDeleteCategory(onDone?: () => void) {
  return usePanelMutation<string, void>({
    run: deleteCategory,
    invalidates: CATEGORY_INVALIDATES,
    success: "Kategoriya o'chirildi",
    onDone,
  });
}
