import { NextResponse } from "next/server";
import { authenticateStaff, parseQuery } from "@/lib/api/route-auth";
import { listInquiries } from "@/lib/api/inquiry-board-repository";
import { inquiryListQuerySchema } from "@/lib/schemas";

/**
 * The board's rows. A seller gets their own leads and the unclaimed pool; a
 * director gets everything. The scope is applied in the repository, never here,
 * so no handler can forget it.
 */
export async function GET(request: Request) {
  const guard = await authenticateStaff();
  if (!guard.ok) {
    return guard.response;
  }

  const query = parseQuery(request.url, inquiryListQuerySchema);
  if (!query.ok) {
    return query.response;
  }

  return NextResponse.json({ success: true, ...(await listInquiries(guard.user, query.data)) });
}
