import { NextResponse } from "next/server";
import { authenticateDirector, parseQuery } from "@/lib/api/route-auth";
import { listAllReviews } from "@/lib/api/review-repository";
import { REVIEWS_MODERATION_PAGE_SIZE } from "@/lib/reviews";
import { adminReviewListQuerySchema } from "@/lib/schemas";

/**
 * The moderation queue: every review, hidden ones included.
 *
 * Director-only. `/api/reviews` is the public sibling and shows approved rows
 * for one product; this one shows everything for every product, which is the
 * whole reason it is a separate route rather than a flag on that one.
 */
export async function GET(request: Request) {
  const guard = await authenticateDirector();
  if (!guard.ok) {
    return guard.response;
  }

  const query = parseQuery(request.url, adminReviewListQuerySchema);
  if (!query.ok) {
    return query.response;
  }

  const page = await listAllReviews(query.data.page, REVIEWS_MODERATION_PAGE_SIZE);

  return NextResponse.json({ success: true, ...page });
}
