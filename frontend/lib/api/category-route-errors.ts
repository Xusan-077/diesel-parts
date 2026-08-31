import "server-only";
import type { NextResponse } from "next/server";
import { apiError } from "./route-auth";
import type { CategoryWriteRefusal } from "./catalog-repository";

/**
 * One table turning a catalog refusal into a status code and a sentence a
 * director can act on, shared by POST, PATCH and DELETE so the three cannot
 * answer differently for the same reason.
 *
 * The two "still in use" refusals are 409: the request was well formed, and
 * what stands in the way is the state of the catalog, which the message names
 * along with the way out of it.
 */
export function categoryRefusal(reason: CategoryWriteRefusal): NextResponse {
  switch (reason) {
    case "not_found":
      return apiError(404, "Kategoriya topilmadi.");
    case "duplicate_slug":
      return apiError(409, "Bu slug allaqachon band. Boshqasini kiriting.");
    case "parent_not_found":
      return apiError(400, "Tanlangan ustun topilmadi.");
    case "parent_not_root":
      return apiError(
        400,
        "Ustun sifatida faqat yuqori bosqichdagi kategoriya tanlanadi — menyu ikki bosqichli.",
      );
    case "has_children":
      return apiError(
        409,
        "Ichida pastki bo'limlar bor. Avval ularni boshqa ustunga ko'chiring yoki o'chiring.",
      );
    case "has_products":
      return apiError(
        409,
        "Bu kategoriyada mahsulotlar bor. Avval ularni boshqa kategoriyaga o'tkazing.",
      );
  }
}
