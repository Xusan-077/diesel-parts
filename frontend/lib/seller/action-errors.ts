import { SellerApiError } from "@/lib/api/seller-panel/client";

const messages: Record<string, string> = {
  exceeds_purchased_qty:
    "Miqdor sotuvda qolgan miqdordan oshdi. Sotuvni qayta tanlab, miqdorni tekshiring.",
  not_returnable: "Faqat yakunlangan yoki qisman qaytarilgan sotuvni tanlang.",
  order_not_found: "Sotuv topilmadi. Boshqa sotuvni tanlang.",
  not_in_order: "Tanlangan mahsulot bu sotuvga tegishli emas.",
  duplicate_return_item: "Bir mahsulotni faqat bir marta tanlang.",
  refund_exceeds_total:
    "Qaytarish summasi tanlangan mahsulotlar summasidan oshmasin.",
  original_payment_ambiguous:
    "Sotuvda yagona to‘lov usuli topilmadi. Qaytarish usulini o‘zingiz tanlang.",
  shift_already_open: "Ochiq smena mavjud. Avval uni yoping.",
  no_open_shift: "Ochiq smena topilmadi. Kassa sahifasini yangilang.",
  shift_comment_required: "Kassadagi farq sababini izohda yozing.",
};

export function actionErrorMessage(
  error: unknown,
  fallback = "Amalni bajarib bo‘lmadi. Qayta urinib ko‘ring.",
) {
  if (!(error instanceof SellerApiError)) return fallback;
  if (messages[error.code]) return messages[error.code];
  if (error.status === 401) return "Sessiya tugadi. Qayta kiring.";
  if (error.status === 403) return "Bu amal uchun ruxsatingiz yo‘q.";
  if (error.status === 400)
    return "Kiritilgan ma’lumotlarni tekshiring va qayta urinib ko‘ring.";
  if (error.status === 404) return "Ma’lumot topilmadi. Sahifani yangilang.";
  if (error.status === 409)
    return "Ma’lumotlar o‘zgargan. Sahifani yangilab qayta urinib ko‘ring.";
  return fallback;
}
