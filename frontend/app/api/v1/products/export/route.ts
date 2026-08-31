import { authenticateDirector } from "@/lib/api/route-auth";
import { backendRequestText } from "@/lib/api/backend-client";
import { getStaffSession } from "@/lib/auth/staff-session";

/**
 * The whole catalog as CSV, retired products included — the export is a working
 * copy the director edits and imports back, so leaving rows out would silently
 * delete nothing and silently recreate everything.
 *
 * Proxies backend/'s own `GET /products/export` (Part 1 Task 7) rather than
 * building the CSV here.
 */
export async function GET() {
  const guard = await authenticateDirector();
  if (!guard.ok) {
    return guard.response;
  }

  const session = await getStaffSession();
  const csv = await backendRequestText("/products/export", { accessToken: session?.accessToken });

  const today = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="diesel-parts-katalog-' + today + '.csv"',
      // A catalog export is a point-in-time snapshot; a cached one is a wrong one.
      "Cache-Control": "no-store",
    },
  });
}
