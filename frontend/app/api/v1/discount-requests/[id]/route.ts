import { NextResponse } from "next/server";
import { authenticateDirector, apiError } from "@/lib/api/route-auth";
import { decideDiscount } from "@/lib/api/discount-repository";
import { discountDecisionSchema } from "@/lib/schemas";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await authenticateDirector();
  if (!guard.ok) {
    return guard.response;
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "Invalid JSON body");
  }

  const parsed = discountDecisionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, errors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const result = await decideDiscount(
    id,
    parsed.data.approve,
    guard.user.id,
    parsed.data.note?.trim() || null,
  );

  if (!result.ok) {
    return result.reason === "not_found"
      ? apiError(404, "So'rov topilmadi.")
      : apiError(409, "Bu so'rov bo'yicha qaror allaqachon qabul qilingan.");
  }

  return NextResponse.json({ success: true });
}
