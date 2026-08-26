import { NextResponse } from "next/server";
import { authenticateDirector, apiError, parseJsonBody } from "@/lib/api/route-auth";
import { callBackendInternal, InternalBackendError } from "@/lib/api/internal-backend";
import { aiGenerateImageRequestSchema, aiGenerateImageResultSchema } from "@/lib/schemas";

/**
 * Generates a studio-style product photo via `backend/`'s Gemini-backed
 * endpoint and hands back the raw image bytes — not a URL. Nothing is
 * uploaded to Blob here: the browser turns this into a `File` and holds it
 * exactly like a director-picked photo, so it only reaches storage if
 * "Tasdiqlash va qo'shish" is actually pressed (see `ProductFormModal`).
 */
export async function POST(request: Request) {
  const guard = await authenticateDirector();
  if (!guard.ok) {
    return guard.response;
  }

  const parsedBody = await parseJsonBody(request, aiGenerateImageRequestSchema);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  let result: unknown;
  try {
    result = await callBackendInternal("ai-generate-image", parsedBody.data);
  } catch (error) {
    if (error instanceof InternalBackendError) {
      console.error(
        "ai-generate-image: backend call failed status=" + error.status + " message=" + error.message,
      );
      return apiError(502, "Rasm generatsiya xizmatiga ulanib bo'lmadi. Birozdan so'ng qayta urinib ko'ring.");
    }
    throw error;
  }

  const parsedResult = aiGenerateImageResultSchema.safeParse(result);
  if (!parsedResult.success) {
    console.error(
      "ai-generate-image: backend response failed schema validation. issues=" +
        JSON.stringify(parsedResult.error.issues),
    );
    return apiError(502, "Rasm generatsiya xizmati noto'g'ri javob qaytardi.");
  }

  return NextResponse.json({ success: true, ...parsedResult.data });
}
