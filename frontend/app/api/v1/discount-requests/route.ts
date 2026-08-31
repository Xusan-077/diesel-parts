import { NextResponse } from "next/server";
import { authenticateDirector } from "@/lib/api/route-auth";
import { listPendingDiscounts } from "@/lib/api/discount-repository";

/**
 * Discount requests still awaiting a decision.
 *
 * No paging and no filter: the queue is what a director has to answer today,
 * and one that needed paging would mean the panel had stopped being used.
 * Decided requests leave it — `/api/v1/discount-requests/[id]` is where they go.
 */
export async function GET() {
  const guard = await authenticateDirector();
  if (!guard.ok) {
    return guard.response;
  }

  return NextResponse.json({ success: true, items: await listPendingDiscounts() });
}
