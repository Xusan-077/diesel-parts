import { NextResponse } from "next/server";
import { authenticateStaff } from "@/lib/api/route-auth";

export async function GET() {
  const guard = await authenticateStaff();

  if (!guard.ok) {
    return guard.response;
  }

  return NextResponse.json({ success: true, user: guard.user });
}
