import { NextResponse } from "next/server";
import { inquirySchema } from "@/lib/schemas";
import { createInquiry } from "@/lib/api/inquiry-repository";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, errors: { _root: ["Invalid JSON body"] } },
      { status: 400 }
    );
  }

  const result = inquirySchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { success: false, errors: result.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    await createInquiry({
      customerName: result.data.name,
      // The column is required; the dialog's phone field is optional.
      phone: result.data.phone ?? "",
      email: result.data.email,
      message: result.data.message,
      source: "PRODUCT_DIALOG",
      productId: result.data.productId,
    });
  } catch (error) {
    console.error("[inquiry] failed to persist", error);
    return NextResponse.json(
      { success: false, errors: { _root: ["Could not save your request. Please try again."] } },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
