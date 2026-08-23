"use client";

import { useMutation, useQueryClient, type QueryKey, type UseMutationResult } from "@tanstack/react-query";
import { toast } from "sonner";
import { SellerApiError } from "@/lib/api/seller-panel/client";

/** Mirrors hooks/admin/use-panel-mutation.ts for the seller panel's own query keys. */
export interface SellerMutationOptions<TVariables, TData> {
  run: (variables: TVariables) => Promise<TData>;
  invalidates: readonly QueryKey[];
  success?: string | ((variables: TVariables, data: TData) => string);
  failure?: string;
  onDone?: (data: TData, variables: TVariables) => void;
}

export function sellerErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof SellerApiError && error.message) {
    return error.message;
  }
  return fallback;
}

export function useSellerMutation<TVariables = void, TData = unknown>({
  run,
  invalidates,
  success,
  failure,
  onDone,
}: SellerMutationOptions<TVariables, TData>): UseMutationResult<TData, unknown, TVariables> {
  const queryClient = useQueryClient();

  return useMutation<TData, unknown, TVariables>({
    mutationFn: run,
    onSuccess: (data, variables) => {
      for (const key of invalidates) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
      onDone?.(data, variables);
      if (success !== undefined) {
        toast.success(typeof success === "function" ? success(variables, data) : success);
      }
    },
    onError: (error) => {
      if (failure !== undefined) {
        toast.error(sellerErrorMessage(error, failure));
      }
    },
  });
}
