import { NextResponse } from "next/server";
import { authenticatePermission, parseJsonBody } from "@/lib/api/route-auth";
import { deleteBrand, updateBrand } from "@/lib/api/brand-repository";
import { brandRefusal } from "@/lib/api/brand-route-errors";
import { brandWriteSchema } from "@/lib/schemas";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await authenticatePermission("products:update");
  if (!guard.ok) {
    return guard.response;
  }

  const body = await parseJsonBody(request, brandWriteSchema);
  if (!body.ok) {
    return body.response;
  }

  const { id } = await params;
  const result = await updateBrand(id, body.data);

  if (!result.ok) {
    return brandRefusal(result.reason);
  }

  return NextResponse.json({ success: true, id: result.id });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await authenticatePermission("products:delete");
  if (!guard.ok) {
    return guard.response;
  }

  const { id } = await params;
  const result = await deleteBrand(id);

  if (!result.ok) {
    return brandRefusal(result.reason);
  }

  return NextResponse.json({ success: true, id });
}
