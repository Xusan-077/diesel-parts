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

  console.log("[quote-request]", result.data);

  return NextResponse.json({ success: true });
}
