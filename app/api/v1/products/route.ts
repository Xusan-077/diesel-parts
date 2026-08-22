import { NextResponse } from "next/server";
import { authenticateDirector, apiError, parseQuery } from "@/lib/api/route-auth";
import {
  ADMIN_PAGE_SIZE,
  createProduct,
  listProductsForAdmin,
} from "@/lib/api/product-write-repository";
import { adminProductListQuerySchema, productWriteSchema } from "@/lib/schemas";

/**
 * The catalogue table's rows.
 *
 * Director-only, like every write below it: this listing exposes stock levels
 * and the archive, neither of which belongs in the public `/api/products`.
 * The page renders the first page itself and seeds React Query with it; this
 * is what the table refetches against after an edit, an archive or a restore.
 */
export async function GET(request: Request) {
  const guard = await authenticateDirector();
  if (!guard.ok) {
    return guard.response;
  }

  const query = parseQuery(request.url, adminProductListQuerySchema);
  if (!query.ok) {
    return query.response;
  }

  const page = await listProductsForAdmin({
    search: query.data.q,
    page: query.data.page,
    includeInactive: query.data.all,
    sort: query.data.sort,
  });

  return NextResponse.json({ success: true, ...page, pageSize: ADMIN_PAGE_SIZE });
}

export async function POST(request: Request) {
  const guard = await authenticateDirector();
  if (!guard.ok) {
    return guard.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "Invalid JSON body");
  }

  const parsed = productWriteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, errors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const result = await createProduct(parsed.data, guard.user.id);

  if (!result.ok) {
    return result.reason === "duplicate"
      ? apiError(409, "Bu " + result.field + " allaqachon band.")
      : apiError(400, "Kategoriya yoki brend topilmadi.");
  }

  return NextResponse.json({ success: true, id: result.value.id }, { status: 201 });
}
