import { NextResponse } from "next/server";
import { quoteRequestSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const body = await request.json();
  const result = quoteRequestSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { success: false, errors: result.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  console.log("[quote-request]", result.data);

  return NextResponse.json({ success: true });
}
