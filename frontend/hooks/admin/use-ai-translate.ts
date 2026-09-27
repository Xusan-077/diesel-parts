"use client";

import { useMutation } from "@tanstack/react-query";
import type { AiEntity } from "@/lib/api/ai-repository";
import { translateEntity } from "@/lib/api/admin/resources";
import type { AiTranslateInput, AiTranslateResult } from "@/lib/schemas";

/**
 * "AI bilan tekshirish" / "Qayta tarjima" — fires `POST /ai/:entity/translate`
 * and hands the result back to the form to review before save.
 *
 * A plain mutation, not `usePanelMutation`: this never touches React Query's
 * cache (nothing here is a list a table reads), and the caller — not a toast
 * — is where a FAILED status or a network error has to show up, right next to
 * the fields it is about.
 */
export function useAiTranslate(entity: AiEntity) {
  return useMutation<AiTranslateResult, unknown, AiTranslateInput>({
    mutationFn: (input) => translateEntity(entity, input),
  });
}
