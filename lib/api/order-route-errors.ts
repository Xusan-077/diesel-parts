import "server-only";
import type { NextResponse } from "next/server";
import { apiError } from "./route-auth";
import type { OrderWriteResult, OrderDiscountResult } from "./order-repository";

/**
 * One table turning a repository refusal into a status code, shared by the
 * order routes so POST and PATCH cannot answer differently for the same reason.
 *
 * `not_found` covers both a missing order and one belonging to another seller,
 * which is why it is 404 rather than 403: a refusal would confirm the order
 * exists.
 */
export function orderWriteError(result: Extract<OrderWriteResult, { ok: false }>): NextResponse {
  switch (result.reason) {
    case "not_found":
      return apiError(404, "Buyurtma topilmadi.");
    case "customer_not_found":
      return apiError(404, "Mijoz topilmadi yoki sizga biriktirilmagan.");
    case "inquiry_not_found":
      return apiError(400, "So'rov topilmadi.");
    case "product_not_found":
      return apiError(400, "Mahsulot topilmadi yoki faol emas: " + result.productId);
    case "price_required":
      return apiError(
        400,
        "Bu mahsulot narxi kelishuv asosida — birlik narxini kiriting: " + result.productId,
      );
    case "insufficient_stock":
      // 409, not 400: the request was well formed and was true when the seller
      // typed it. What changed is the shelf.
      return apiError(
        409,
        result.productName +
          " — zaxirada " +
          result.available +
          " dona qoldi, so'ralgani " +
          result.requested +
          " dona.",
      );
    case "locked":
      return apiError(409, "Tasdiqlangan buyurtmaning tarkibi o'zgartirilmaydi.");
    case "illegal_transition":
      return apiError(409, "Holatni " + result.from + " dan " + result.to + " ga o'tkazib bo'lmaydi.");
    case "number_conflict":
      return apiError(409, "Buyurtma raqami band bo'lib qoldi. Qaytadan urinib ko'ring.");
  }
}

export function orderDiscountError(
  result: Extract<OrderDiscountResult, { ok: false }>,
): NextResponse {
  switch (result.reason) {
    case "not_found":
      return apiError(404, "Buyurtma topilmadi.");
    case "locked":
      return apiError(409, "Tasdiqlangan buyurtmaga chegirma qo'llanmaydi.");
    case "pending_exists":
      return apiError(409, "Bu buyurtma bo'yicha ko'rib chiqilmagan so'rov allaqachon bor.");
  }
}
