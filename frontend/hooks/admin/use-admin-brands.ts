"use client";

import { useQuery } from "@tanstack/react-query";
import { adminKeys } from "@/lib/api/admin/keys";
import { createBrand, deleteBrand, fetchAdminBrands, updateBrand } from "@/lib/api/admin/resources";
import type { BrandRow } from "@/lib/api/brand-repository";
import type { BrandWriteInput } from "@/lib/schemas";
import { usePanelMutation } from "./use-panel-mutation";

export function useAdminBrands(initialData?: BrandRow[]) {
  return useQuery({
    queryKey: adminKeys.brands.list(),
    queryFn: fetchAdminBrands,
    initialData,
    staleTime: 30_000,
  });
}

const BRAND_INVALIDATES = [adminKeys.brands.all, adminKeys.audit.all] as const;

export function useCreateBrand(onDone?: () => void) {
  return usePanelMutation<BrandWriteInput, { id: string }>({
    run: createBrand,
    invalidates: BRAND_INVALIDATES,
    success: "Brend qo'shildi",
    onDone,
  });
}

export function useUpdateBrand(onDone?: () => void) {
  return usePanelMutation<{ id: string; values: BrandWriteInput }, void>({
    run: ({ id, values }) => updateBrand(id, values),
    invalidates: BRAND_INVALIDATES,
    success: "Brend saqlandi",
    onDone,
  });
}

export function useDeleteBrand(onDone?: () => void) {
  return usePanelMutation<string, void>({
    run: deleteBrand,
    invalidates: BRAND_INVALIDATES,
    success: "Brend o'chirildi",
    onDone,
  });
}
