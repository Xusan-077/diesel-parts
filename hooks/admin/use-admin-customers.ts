"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminKeys } from "@/lib/api/admin/keys";
import {
  claimCustomer,
  createCustomer,
  fetchCustomers,
  updateCustomer,
  type CustomerListResult,
} from "@/lib/api/admin/resources";
import type {
  CustomerCreateInput,
  CustomerListQuery,
  CustomerUpdateInput,
} from "@/lib/schemas";
import { PANEL_STALE_MS, usePanelMutation } from "./use-panel-mutation";

/**
 * A seller's customer book, or the unclaimed pool.
 *
 * `pool` is part of the key, not a filter applied after the fact: the two are
 * different lists of different rows, and a claim moves a customer from one to
 * the other. Both are invalidated together for that reason.
 */
export function useAdminCustomers(
  query: CustomerListQuery,
  initialData?: CustomerListResult,
) {
  return useQuery({
    queryKey: adminKeys.customers.list(query),
    queryFn: () => fetchCustomers(query),
    initialData,
    staleTime: PANEL_STALE_MS,
  });
}

/**
 * Rereads every customer list on demand.
 *
 * For the one case a mutation's own invalidation does not cover: a refused
 * claim. The write failed, so nothing it would have invalidated changed — but
 * the refusal itself is evidence that this screen's picture of the account is
 * stale, because somebody else got there first.
 */
export function useCustomerRefresh() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: adminKeys.customers.all });
  };
}

/*
 * The create is silent on both sides: it is called from two places that report
 * differently — the customer screen's own form, which pins refusals to fields,
 * and the board's "save this caller" button, which turns itself into a link to
 * the new card.
 */
export function useCreateCustomer() {
  return usePanelMutation<CustomerCreateInput, { id?: string }>({
    run: createCustomer,
    invalidates: [adminKeys.customers.all],
  });
}

export function useUpdateCustomer(onDone?: () => void) {
  return usePanelMutation<{ id: string; values: CustomerUpdateInput }, void>({
    run: ({ id, values }) => updateCustomer(id, values),
    invalidates: [adminKeys.customers.all, adminKeys.audit.all],
    onDone,
  });
}

/**
 * Taking a customer out of the unclaimed pool.
 *
 * Invalidates the whole resource rather than the two lists by name: the row
 * leaves the pool and joins the book in one write, and naming the prefix is
 * what makes that one fact instead of two that could be updated apart.
 */
export function useClaimCustomer(onDone?: () => void) {
  return usePanelMutation<string, void>({
    run: claimCustomer,
    invalidates: [adminKeys.customers.all, adminKeys.audit.all],
    success: "Mijoz sizga biriktirildi",
    failure: "Biriktirib bo'lmadi. Qaytadan urinib ko'ring.",
    onDone,
  });
}
