import { NextResponse } from "next/server";
import {
  AUTH_HINT_COOKIE,
  PENDING_PHONE_COOKIE,
  SESSION_COOKIE,
} from "@/lib/auth/session";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.delete(AUTH_HINT_COOKIE);
  response.cookies.delete(PENDING_PHONE_COOKIE);
  return response;
}
