import { NextResponse } from "next/server";
import { apiError, authenticatePermission, parseJsonBody } from "@/lib/api/route-auth";
import { translateEntity, type AiEntity } from "@/lib/api/ai-repository";
import { aiTranslateRequestSchema } from "@/lib/schemas";
import type { Permission } from "@/lib/auth/permissions";

/**
 * "AI bilan tekshirish" / "Qayta tarjima". One dynamic route rather than
 * three, but the permission still differs by entity — same split as
 * backend/'s `ai.controller.ts`, which this proxies unchanged.
 */
const ENTITY_PERMISSION: Record<AiEntity, Permission> = {
  products: "products:update",
  brands: "products:update",
  categories: "categories:update",
};

function isAiEntity(value: string): value is AiEntity {
  return value === "products" || value === "categories" || value === "brands";
}

export async function POST(request: Request, { params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params;
  if (!isAiEntity(entity)) {
    return apiError(404, "Unknown AI entity");
  }

  const guard = await authenticatePermission(ENTITY_PERMISSION[entity]);
  if (!guard.ok) {
    return guard.response;
  }

  const body = await parseJsonBody(request, aiTranslateRequestSchema);
  if (!body.ok) {
    return body.response;
  }

  const result = await translateEntity(entity, body.data);
  return NextResponse.json(result);
}
