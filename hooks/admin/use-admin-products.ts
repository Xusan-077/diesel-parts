"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminKeys } from "@/lib/api/admin/keys";
import { requestErrorMessage } from "@/lib/api/request-error";
import {
  aiFillProduct,
  aiGenerateProductImage,
  archiveProduct,
  createProduct,
  fetchAdminProducts,
  fetchProductForEdit,
  replaceProductImage,
  restoreProduct,
  updateProduct,
} from "@/lib/api/admin/resources";
import type { AdminProductPage, ProductEditRecord } from "@/lib/api/product-write-repository";
import type { AdminProductListQuery, AiFillResult, ProductWriteInput } from "@/lib/schemas";
import { PANEL_STALE_MS, usePanelMutation } from "./use-panel-mutation";

/**
 * The catalogue table.
 *
 * Seeded from the page's own server render, so the first paint is the table
 * rather than a skeleton and the search, sort and paging links keep working
 * exactly as they did — they are URL state, resolved on the server, and this
 * hook's key includes that state so a new URL is a new cache entry.
 *
 * `staleTime` is what stops the seed being thrown away. With zero, React Query
 * treats freshly seeded data as stale and refetches on mount — so every visit
 * would ask the API for the page the server had just rendered. `PANEL_STALE_MS`
 * is short enough that a director walking between screens sees current numbers,
 * and their own writes do not wait for it at all: invalidation refetches an
 * active query whatever its staleTime says.
 */
export function useAdminProducts(query: AdminProductListQuery, initialData?: AdminProductPage) {
  return useQuery({
    queryKey: adminKeys.products.list(query),
    queryFn: () => fetchAdminProducts(query),
    initialData,
    staleTime: PANEL_STALE_MS,
  });
}

/**
 * Loads the write payload behind one row, for the dialog that is about to edit
 * it.
 *
 * Imperative rather than a `useQuery`, and deliberately: the request is started
 * by a press, not by something being on screen, and its failure has to be told
 * to the director at that moment. A declarative query would report the failure
 * as state, which would take an effect to turn back into a toast — a
 * cascading render to express something the click already knew.
 *
 * It still goes through the cache. `fetchQuery` reads a fresh entry rather than
 * refetching, so reopening the same row inside five minutes costs nothing, and
 * a saved edit invalidates that entry like any other product key.
 */
export function useProductEditLoader() {
  const queryClient = useQueryClient();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const load = async (id: string): Promise<ProductEditRecord | null> => {
    setLoadingId(id);
    try {
      return await queryClient.fetchQuery({
        queryKey: adminKeys.products.edit(id),
        queryFn: () => fetchProductForEdit(id),
        staleTime: 5 * 60_000,
      });
    } catch (error) {
      toast.error(requestErrorMessage(error, "Mahsulot ma'lumotlari yuklanmadi."));
      return null;
    } finally {
      setLoadingId(null);
    }
  };

  return { load, loadingId };
}

/*
 * The two write hooks carry neither toast. The form that calls them pins a
 * refusal to the field it belongs to — a duplicate SKU has to appear under the
 * SKU box, not in a corner of the screen — and says its own piece on success,
 * so anything fired here would be a second copy of both.
 */
export function useCreateProduct() {
  return usePanelMutation<{ values: ProductWriteInput; image?: File | null }, { id: string }>({
    run: ({ values, image }) => createProduct(values, image),
    invalidates: [adminKeys.products.all, adminKeys.audit.all],
  });
}

export function useUpdateProduct() {
  return usePanelMutation<{ id: string; values: ProductWriteInput }, void>({
    // `products.all` is the prefix of every product key, the cached edit
    // payloads included — so a saved edit invalidates the form's own copy too.
    run: ({ id, values }) => updateProduct(id, values),
    invalidates: [adminKeys.products.all, adminKeys.audit.all],
  });
}

/**
 * Replaces one product's photo. Separate from `useUpdateProduct` because it
 * hits its own endpoint with its own body — see `PATCH /products/[id]/image`
 * — and the form only calls it when a new file was actually chosen.
 */
export function useReplaceProductImage() {
  return usePanelMutation<{ id: string; image: File }, { imageUrl: string }>({
    run: ({ id, image }) => replaceProductImage(id, image),
    invalidates: [adminKeys.products.all],
  });
}

/**
 * "OEM raqam bilan (AI)" — looks a part up and returns a write payload for
 * the create dialog to pre-fill. No cache to invalidate (nothing is written)
 * and no toast: the dialog shows the result itself, and a refusal has to
 * stay next to the OEM input it belongs to, exactly like `useCreateProduct`.
 */
export function useAiFillProduct() {
  return usePanelMutation<{ oemNumber: string; category?: string }, AiFillResult>({
    run: ({ oemNumber, category }) => aiFillProduct(oemNumber, category),
    invalidates: [],
  });
}

/** Generates a studio photo for the AI-filled form. Same no-toast reasoning as `useAiFillProduct`. */
export function useAiGenerateProductImage() {
  return usePanelMutation<{ productName: string; oemNumber?: string }, { base64: string; mimeType: string }>({
    run: ({ productName, oemNumber }) => aiGenerateProductImage(productName, oemNumber),
    invalidates: [],
  });
}

/**
 * Archive and restore are one mutation with a flag rather than two hooks: they
 * are the same button in the same column, and a caller that had to pick
 * between two hooks before it knew which way the row was going would end up
 * calling both.
 */
export function useSetProductActive(onDone?: () => void) {
  return usePanelMutation<{ id: string; active: boolean }, void>({
    run: ({ id, active }) => (active ? restoreProduct(id) : archiveProduct(id)),
    invalidates: [adminKeys.products.all, adminKeys.audit.all],
    success: ({ active }) =>
      active ? "Mahsulot katalogga qaytarildi" : "Mahsulot arxivga olindi",
    // No failure toast: the confirm dialog stays open on a refusal and prints
    // the message inside itself, which is where the director is still looking.
    onDone,
  });
}
