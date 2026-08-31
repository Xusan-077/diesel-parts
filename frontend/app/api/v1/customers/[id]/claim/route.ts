import { NextResponse } from "next/server";
import { apiError, authenticateStaff } from "@/lib/api/route-auth";
import { claimCustomer } from "@/lib/api/customer-repository";

/** Takes an unassigned account into the seller's own book. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await authenticateStaff();
  if (!guard.ok) {
    return guard.response;
  }

  const { id } = await params;
  const result = await claimCustomer(id, guard.user);

  if (!result.ok) {
    return result.reason === "not_found"
      ? apiError(404, "Mijoz topilmadi.")
      : apiError(409, "Bu mijoz allaqachon boshqa sotuvchiga biriktirilgan.");
  }

  return NextResponse.json({ success: true, id });
}
