"use client";

import {
  useMutation,
  useQueryClient,
  type QueryKey,
  type UseMutationResult,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { requestErrorMessage } from "@/lib/api/request-error";

/**
 * How long a panel listing counts as fresh.
 *
 * It exists to protect the server-rendered seed. Every panel page reads its
 * first screen on the server and hands it to React Query; with a staleTime of
 * zero that seed is stale the instant it lands, and the browser immediately
 * asks the API for what it is already showing.
 *
 * Half a minute, not five: two directors work the same queues, and a stale
 * inquiry board is worse than a redundant request. Their own writes never wait
 * this long — `invalidateQueries` refetches an active query regardless.
 */
export const PANEL_STALE_MS = 30_000;

export interface PanelMutationOptions<TVariables, TData> {
  /** The request itself. */
  run: (variables: TVariables) => Promise<TData>;
  /**
   * Cache keys to invalidate once it succeeds. Prefixes, not exact keys: a
   * write cannot know which page or search term a reader is on, so it
   * invalidates the resource and lets React Query match every key under it.
   */
  invalidates: readonly QueryKey[];
  /** Toast on success. A function when the sentence depends on what was sent. */
  success?: string | ((variables: TVariables, data: TData) => string);
  /**
   * Toast when the request failed. The server's own sentence wins where it sent
   * one — it knows which SKU is taken and this does not — so this is the
   * fallback for a refusal that carried no message, and for a request that
   * never landed.
   *
   * Omit it where the caller shows the failure itself: a form that pins
   * messages to the fields they belong to, or a confirm dialog that keeps the
   * message inside the dialog the director is still looking at. Those read
   * `mutation.error` through `requestErrorMessage`, and a toast on top of that
   * would say the same thing twice.
   */
  failure?: string;
  /** Runs after a success, before the toast. For closing the dialog that sent it. */
  onDone?: (data: TData, variables: TVariables) => void;
}

/**
 * One write in the panel: the request, what it invalidates, and what the
 * director is told about it.
 *
 * This exists because the alternative was thirty copies of the same six lines.
 * Every panel mutation has to invalidate the list it changed, say something on
 * success, and turn an axios rejection into a sentence — and before React
 * Query, each of those was hand-rolled next to a `router.refresh()`, which is
 * why they had drifted into three different phrasings of "try again".
 *
 * Invalidation replaces that `router.refresh()`. The difference that matters:
 * `refresh()` re-ran the whole route, header and sidebar included, and could
 * not say what had changed; this re-reads exactly the queries whose data the
 * write invalidated, and leaves everything else on screen untouched.
 *
 * Errors are deliberately not swallowed. The toast is fired here, and the
 * rejection still reaches the caller, so a dialog that wants to keep itself
 * open and print the message inline can await `mutateAsync` and catch.
 */
export function usePanelMutation<TVariables = void, TData = unknown>({
  run,
  invalidates,
  success,
  failure,
  onDone,
}: PanelMutationOptions<TVariables, TData>): UseMutationResult<TData, unknown, TVariables> {
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
        toast.error(requestErrorMessage(error, failure));
      }
    },
  });
}
