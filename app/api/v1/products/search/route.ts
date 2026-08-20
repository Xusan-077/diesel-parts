import { NextResponse } from "next/server";
import { authenticateStaff, parseQuery } from "@/lib/api/route-auth";
import { searchSellableProducts } from "@/lib/api/product-lookup-repository";
import { productLookupQuerySchema } from "@/lib/schemas";

/**
 * The catalog lookup the order form types into.
 *
 * Staff-only rather than director-only: raising an order is a seller's job, so
 * a seller has to be able to find the part. It returns stock alongside the
 * price because the two are read together — a seller quoting a part is
 * deciding whether to promise it today.
 */
export async function GET(request: Request) {
  const guard = await authenticateStaff();
  if (!guard.ok) {
    return guard.response;
  }

  const query = parseQuery(request.url, productLookupQuerySchema);
  if (!query.ok) {
    return query.response;
  }

  return NextResponse.json({ success: true, items: await searchSellableProducts(query.data.q) });
}
