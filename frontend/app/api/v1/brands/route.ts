import { NextResponse } from "next/server";
import { authenticatePermission, parseJsonBody } from "@/lib/api/route-auth";
import { createBrand, listBrandsForAdmin } from "@/lib/api/brand-repository";
import { brandWriteSchema } from "@/lib/schemas";
import { brandRefusal } from "@/lib/api/brand-route-errors";

export async function GET() {
  const guard = await authenticatePermission("products:read");
  if (!guard.ok) {
    return guard.response;
  }

  return NextResponse.json({ items: await listBrandsForAdmin() });
}

export async function POST(request: Request) {
  const guard = await authenticatePermission("products:create");
  if (!guard.ok) {
    return guard.response;
  }

  const body = await parseJsonBody(request, brandWriteSchema);
  if (!body.ok) {
    return body.response;
  }

  const result = await createBrand(body.data);
  if (!result.ok) {
    return brandRefusal(result.reason);
  }

  return NextResponse.json({ success: true, id: result.id }, { status: 201 });
}
