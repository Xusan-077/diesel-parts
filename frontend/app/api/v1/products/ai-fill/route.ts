import { NextResponse } from "next/server";
import { authenticateDirector, apiError, parseJsonBody } from "@/lib/api/route-auth";
import { listBrands, listCategories } from "@/lib/api/product-repository";
import { callBackendInternal, InternalBackendError } from "@/lib/api/internal-backend";
import { aiFillRequestSchema, aiFillResultSchema } from "@/lib/schemas";

/**
 * "OEM raqam bilan (AI)" — looks a part up by its OEM number through
 * `backend/`'s Gemini-backed endpoint (Google Search grounding) and hands
 * back a pre-filled (never saved) product write payload for the create
 * dialog to show for review.
 *
 * The category/brand lists are fetched from *this* app's own database and
 * sent along in the request: the backend has no other way to answer with an
 * id valid here, since the two services keep entirely separate Postgres
 * databases (see `AiController`'s doc comment on the backend side).
 */
export async function POST(request: Request) {
  const guard = await authenticateDirector();
  if (!guard.ok) {
    return guard.response;
  }

  const parsedBody = await parseJsonBody(request, aiFillRequestSchema);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const [categories, brands] = await Promise.all([listCategories(), listBrands()]);

  let result: unknown;
  try {
    result = await callBackendInternal("ai-fill", {
      oemNumber: parsedBody.data.oemNumber,
      category: parsedBody.data.category,
      categories: categories.map((c) => ({ id: c.id, label: c.name.uz })),
      brands: brands.map((b) => ({ id: b.id, label: b.name })),
    });
  } catch (error) {
    if (error instanceof InternalBackendError) {
      // The dev log capture only keeps a single string argument off
      // `console.error` — a second object argument is dropped to `{}` — so
      // everything worth seeing is inlined into the one string.
      console.error(
        "ai-fill: backend call failed status=" + error.status + " message=" + error.message,
      );
      return apiError(502, "AI xizmatiga ulanib bo'lmadi. Birozdan so'ng qayta urinib ko'ring.");
    }
    throw error;
  }

  const parsedResult = aiFillResultSchema.safeParse(result);
  if (!parsedResult.success) {
    // Logged rather than silently swallowed: the director only ever sees the
    // generic sentence below, and without this there is no way to tell a
    // genuinely malformed backend reply apart from a schema the two sides
    // have drifted on.
    console.error(
      "ai-fill: backend response failed schema validation. issues=" +
        JSON.stringify(parsedResult.error.issues) +
        " result=" +
        JSON.stringify(result),
    );
    return apiError(502, "AI xizmati noto'g'ri javob qaytardi.");
  }

  return NextResponse.json({ success: true, result: parsedResult.data });
}
