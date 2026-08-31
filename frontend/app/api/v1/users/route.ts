import { NextResponse } from "next/server";
import { authenticateDirector, apiError } from "@/lib/api/route-auth";
import { createStaff, listStaff } from "@/lib/api/user-repository";
import { userCreateSchema } from "@/lib/schemas";

export async function GET() {
  const guard = await authenticateDirector();
  if (!guard.ok) {
    return guard.response;
  }

  return NextResponse.json({ success: true, users: await listStaff() });
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

  const parsed = userCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, errors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const result = await createStaff(parsed.data, guard.user.id);

  if (!result.ok) {
    return apiError(409, "Bu email allaqachon ro'yxatdan o'tgan.");
  }

  return NextResponse.json({ success: true, id: result.id }, { status: 201 });
}
