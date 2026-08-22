import { NextResponse } from "next/server";
import { authenticateDirector, parseQuery } from "@/lib/api/route-auth";
import { listAudit, listAuditEntityTypes } from "@/lib/api/discount-repository";
import { auditListQuerySchema } from "@/lib/schemas";

/**
 * The audit trail, newest first, optionally narrowed to one kind of record.
 *
 * The entity-type list comes back with every page rather than from a second
 * endpoint: it is a handful of short strings, it is what the filter above the
 * table is built from, and a filter that arrives after the rows it filters is
 * a filter that moves under the pointer.
 */
export async function GET(request: Request) {
  const guard = await authenticateDirector();
  if (!guard.ok) {
    return guard.response;
  }

  const query = parseQuery(request.url, auditListQuerySchema);
  if (!query.ok) {
    return query.response;
  }

  const [page, entityTypes] = await Promise.all([
    listAudit(query.data.page, query.data.entityType),
    listAuditEntityTypes(),
  ]);

  return NextResponse.json({ success: true, ...page, entityTypes });
}
