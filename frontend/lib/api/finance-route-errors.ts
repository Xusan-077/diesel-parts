import "server-only";
import { NextResponse } from "next/server";
import { apiError } from "./route-auth";
import { BackendApiError } from "./backend-client";

/**
 * Turns a finance write failure into a panel response — the same shape as
 * `warehouseWriteError`. `backend/`'s finance services answer in Uzbek
 * sentences a director can act on ("To'lov qarzdan oshib ketdi", ...), so a
 * 4xx forwards the message; anything else is a 502 (the panel is up, the
 * service behind it is not).
 */
export function financeWriteError(error: unknown): NextResponse {
  if (error instanceof BackendApiError) {
    if (error.status >= 400 && error.status < 500) {
      return apiError(error.status, error.message || "So'rov rad etildi.");
    }
    return apiError(502, "Moliya xizmati javob bermadi. Birozdan so'ng qayta urinib ko'ring.");
  }
  throw error;
}
