import "server-only";
import { backendRequest } from "./backend-client";
import { getStaffSession } from "@/lib/auth/staff-session";
import type { AiTranslateInput, AiTranslateResult } from "@/lib/schemas";

/**
 * The panel's "AI bilan tekshirish" / "Qayta tarjima" action. One backend
 * route per entity (`ai.controller.ts`) rather than one shared route with an
 * `entity` body field, because each gates on a different permission
 * (`categories:update` vs `products:update`) — the same split the entity
 * services themselves use.
 */
export type AiEntity = "products" | "categories" | "brands";

async function accessToken(): Promise<string | undefined> {
  const session = await getStaffSession();
  return session?.accessToken;
}

export async function translateEntity(
  entity: AiEntity,
  input: AiTranslateInput,
): Promise<AiTranslateResult> {
  return backendRequest<AiTranslateResult>(`/ai/${entity}/translate`, {
    method: "POST",
    accessToken: await accessToken(),
    body: input,
  });
}
