import { NextResponse } from "next/server";
import { authenticateStaff } from "@/lib/api/route-auth";
import { readInquiryBoardView } from "@/lib/api/inquiry-board-view";

/**
 * The seller's board, in the shape the screen draws.
 *
 * Distinct from `GET /api/v1/inquiries`, which answers with one flat page of
 * rows for a list: this one answers with five capped columns, their totals and
 * the derived labels a card carries. The board polls it while the tab is open
 * and rereads it after every claim and move.
 *
 * Staff, not director-only: this is a seller's own screen. What they may see is
 * decided by the scope inside the repository, which is why no filtering happens
 * here.
 */
export async function GET() {
  const guard = await authenticateStaff();
  if (!guard.ok) {
    return guard.response;
  }

  return NextResponse.json(await readInquiryBoardView(guard.user));
}
