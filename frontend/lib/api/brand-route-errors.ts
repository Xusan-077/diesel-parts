import "server-only";
import type { NextResponse } from "next/server";
import { apiError } from "./route-auth";
import type { BrandWriteRefusal } from "./brand-repository";

export function brandRefusal(reason: BrandWriteRefusal): NextResponse {
  switch (reason) {
    case "not_found":
      return apiError(404, "Brend topilmadi.");
    case "duplicate_name":
      return apiError(409, "Bu nom allaqachon band. Boshqasini kiriting.");
  }
}
