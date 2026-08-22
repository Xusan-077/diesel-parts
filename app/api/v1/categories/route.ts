import { NextResponse } from "next/server";
import { authenticateDirector, parseJsonBody } from "@/lib/api/route-auth";
import { createCategory, listCatalogRows } from "@/lib/api/catalog-repository";
import { categoryWriteSchema } from "@/lib/schemas";
import { categoryRefusal } from "@/lib/api/category-route-errors";

export async function GET() {
  const guard = await authenticateDirector();
  if (!guard.ok) {
    return guard.response;
  }

  return NextResponse.json({ items: await listCatalogRows() });
}

export async function POST(request: Request) {
  const guard = await authenticateDirector();
  if (!guard.ok) {
    return guard.response;
  }

  const body = await parseJsonBody(request, categoryWriteSchema);
  if (!body.ok) {
    return body.response;
  }

  const result = await createCategory(body.data, guard.user.id);
  if (!result.ok) {
    return categoryRefusal(result.reason);
  }

  return NextResponse.json({ success: true, id: result.id }, { status: 201 });
}
