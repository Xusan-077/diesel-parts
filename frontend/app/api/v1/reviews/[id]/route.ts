import { NextResponse } from "next/server";
import { apiError, authenticateDirector, parseJsonBody } from "@/lib/api/route-auth";
import { deleteReview, setReviewApproval } from "@/lib/api/review-repository";
import { recordAudit } from "@/lib/api/audit";
import { reviewModerateSchema } from "@/lib/schemas";

/** Takes a review off the site, or puts it back. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const guard = await authenticateDirector();
  if (!guard.ok) {
    return guard.response;
  }

  const body = await parseJsonBody(request, reviewModerateSchema);
  if (!body.ok) {
    return body.response;
  }

  const { id } = await params;

  try {
    await setReviewApproval(id, body.data.isApproved);
  } catch {
    return apiError(404, "Sharh topilmadi.");
  }

  // Judging someone's words is exactly the kind of act the trail exists for:
  // it changes what the public sees and leaves no other record.
  await recordAudit({
    userId: guard.user.id,
    action: body.data.isApproved ? "APPROVE" : "REJECT",
    entityType: "Review",
    entityId: id,
    after: { isApproved: body.data.isApproved },
  });

  return NextResponse.json({ success: true, id });
}

/**
 * Deletes the row outright.
 *
 * Unlike a product — which is retired rather than deleted, because orders
 * reference it — nothing points at a review, and spam is not a record anyone
 * needs kept. Hiding is the reversible option and it is one button away; this
 * one is for what should never have been written.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const guard = await authenticateDirector();
  if (!guard.ok) {
    return guard.response;
  }

  const { id } = await params;

  try {
    await deleteReview(id);
  } catch {
    return apiError(404, "Sharh topilmadi.");
  }

  await recordAudit({
    userId: guard.user.id,
    action: "DELETE",
    entityType: "Review",
    entityId: id,
  });

  return NextResponse.json({ success: true, id });
}
