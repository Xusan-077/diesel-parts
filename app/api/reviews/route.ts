import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { apiError, parseJsonBody, parseQuery } from "@/lib/api/route-auth";
import { listProductReviews, upsertReview } from "@/lib/api/review-repository";
import { reviewCreateSchema, reviewListQuerySchema } from "@/lib/schemas";

/**
 * One page of a product's reviews.
 *
 * Open to everyone — reviews are what the page is for — but the session is
 * still read, so a signed-in reader's own entry comes back marked. Nothing
 * about the session changes which rows are returned.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const query = parseQuery(request.url, reviewListQuerySchema);
  if (!query.ok) {
    return query.response;
  }

  const session = await getSession();
  const { productId, page, pageSize } = query.data;

  return NextResponse.json(
    await listProductReviews(productId, page, pageSize, session?.phone),
  );
}

/**
 * Writes the caller's review of a part.
 *
 * The identity is the session's phone and never the request body. A caller who
 * could name their own author would be able to review one part under a hundred
 * identities, and the unique index behind "one review per person" would be
 * decoration.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    // 401 rather than a redirect: the form is on a page the reader is already
    // looking at, and it prints this rather than navigating away from it.
    return apiError(401, "Sharh qoldirish uchun tizimga kiring.");
  }

  const body = await parseJsonBody(request, reviewCreateSchema);
  if (!body.ok) {
    return body.response;
  }

  const { productId, rating, body: text, authorName } = body.data;

  try {
    return NextResponse.json(
      await upsertReview({
        productId,
        authorPhone: session.phone,
        rating,
        body: text,
        authorName,
      }),
      { status: 201 },
    );
  } catch {
    /*
     * The one failure worth naming. `productId` arrives from the browser, so a
     * part that was retired between the page rendering and the button being
     * pressed lands here as a foreign-key violation — not something the reader
     * did wrong, and not something a generic 500 explains.
     */
    return apiError(400, "Bu mahsulotga sharh qoldirib bo'lmadi.");
  }
}
