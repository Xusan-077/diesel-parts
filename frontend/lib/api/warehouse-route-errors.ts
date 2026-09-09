import "server-only";
import { NextResponse } from "next/server";
import { apiError } from "./route-auth";
import { BackendApiError } from "./backend-client";

/**
 * Turns a warehouse write failure into a panel response.
 *
 * `backend/`'s warehouse services already answer in Uzbek sentences a director
 * can act on — "Ombor kodi band: W3", "Faqat DRAFT holatidagi qabulni
 * tasdiqlash mumkin", "Menejer sifatida ko'rsatilgan foydalanuvchi topilmadi"
 * — so this mostly forwards the message under a sane status rather than
 * re-writing it. A 4xx passes through; anything else is a 502 (the panel is
 * up, the service behind it is not).
 */
export function warehouseWriteError(error: unknown): NextResponse {
  if (error instanceof BackendApiError) {
    if (error.status >= 400 && error.status < 500) {
      return apiError(error.status, error.message || "So'rov rad etildi.");
    }
    return apiError(502, "Ombor xizmati javob bermadi. Birozdan so'ng qayta urinib ko'ring.");
  }
  throw error;
}
