import { NextResponse } from "next/server";
import { quoteRequestSchema } from "@/lib/schemas";

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

  const result = quoteRequestSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { success: false, errors: result.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { cartItems, ...contact } = result.data;

  // TODO(Xusan): forward to a CRM or mailbox once one exists.
  console.log("[quote-request]", contact);
  if (cartItems?.length) {
    console.log(
      "[quote-request] cart:",
      cartItems.map((item) => `${item.sku} × ${item.quantity}`).join(", ")
    );
  }

  return NextResponse.json({ success: true });
}
