import { NextResponse } from "next/server";
import { authenticateDirector, apiError } from "@/lib/api/route-auth";
import { createProduct } from "@/lib/api/product-write-repository";
import { productWriteSchema } from "@/lib/schemas";

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
