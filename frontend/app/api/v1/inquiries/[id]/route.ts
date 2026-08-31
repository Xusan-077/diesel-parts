import { NextResponse } from "next/server";
import { apiError, authenticateStaff, parseJsonBody } from "@/lib/api/route-auth";
import { updateInquiry } from "@/lib/api/inquiry-board-repository";
import { inquiryUpdateSchema } from "@/lib/schemas";

/**
 * Moves a card, leaves a note, or sets a callback date.
 *
 * Only the seller the lead is assigned to may write to it, and a director may
 * write to any. An unowned lead answers 404 rather than 403: a refusal would
 * confirm the row exists, which tells one seller another seller's lead is real.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await authenticateStaff();
  if (!guard.ok) {
    return guard.response;
  }

  const { id } = await params;

  const body = await parseJsonBody(request, inquiryUpdateSchema);
  if (!body.ok) {
    return body.response;
  }

  const result = await updateInquiry(id, body.data, guard.user);

  if (!result.ok) {
    return apiError(404, "So'rov topilmadi yoki sizga biriktirilmagan.");
  }

  return NextResponse.json({ success: true, id });
}
