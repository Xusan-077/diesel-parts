import { NextResponse } from "next/server";
import { authenticateDirector, apiError } from "@/lib/api/route-auth";
import { updateStaff } from "@/lib/api/user-repository";
import { userUpdateSchema } from "@/lib/schemas";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await authenticateDirector();
  if (!guard.ok) {
    return guard.response;
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "Invalid JSON body");
  }

  const parsed = userUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, errors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const result = await updateStaff(id, parsed.data, guard.user.id);

  if (!result.ok) {
    if (result.reason === "not_found") {
      return apiError(404, "Foydalanuvchi topilmadi.");
    }
    if (result.reason === "last_director") {
      return apiError(
        409,
        "Bu yagona faol direktor. Avval boshqa direktor tayinlang, keyin o'zgartiring.",
      );
    }
    return apiError(409, "Bu email allaqachon ro'yxatdan o'tgan.");
  }

  return NextResponse.json({ success: true, id });
}
