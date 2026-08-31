import { NextResponse } from "next/server";
import { apiError, authenticateStaff } from "@/lib/api/route-auth";
import { claimInquiry } from "@/lib/api/inquiry-board-repository";

/**
 * Takes a lead out of the pool.
 *
 * Takes no body: the only thing being said is "this one is mine", and the
 * claimer is the signed-in user. Losing the race answers 409, because two
 * sellers tapping the same card a second apart is the expected case and the
 * loser has to be told the lead is gone.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await authenticateStaff();
  if (!guard.ok) {
    return guard.response;
  }

  const { id } = await params;
  const result = await claimInquiry(id, guard.user);

  if (!result.ok) {
    return result.reason === "not_found"
      ? apiError(404, "So'rov topilmadi.")
      : apiError(409, "Bu so'rovni boshqa sotuvchi allaqachon band qilgan.");
  }

  return NextResponse.json({ success: true, id });
}
