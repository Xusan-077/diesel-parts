import { NextResponse } from "next/server";
import { authenticateDirector, parseJsonBody } from "@/lib/api/route-auth";
import { deleteCategory, updateCategory } from "@/lib/api/catalog-repository";
import { categoryRefusal } from "@/lib/api/category-route-errors";
import { categoryWriteSchema } from "@/lib/schemas";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await authenticateDirector();
  if (!guard.ok) {
    return guard.response;
  }

  const body = await parseJsonBody(request, categoryWriteSchema);
  if (!body.ok) {
    return body.response;
  }

  const { id } = await params;
  const result = await updateCategory(id, body.data, guard.user.id);

  if (!result.ok) {
    return categoryRefusal(result.reason);
  }

  return NextResponse.json({ success: true, id: result.id });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await authenticateDirector();
  if (!guard.ok) {
    return guard.response;
  }

  const { id } = await params;
  const result = await deleteCategory(id, guard.user.id);

  if (!result.ok) {
    return categoryRefusal(result.reason);
  }

  return NextResponse.json({ success: true, id });
}
