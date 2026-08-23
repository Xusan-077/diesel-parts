import type { OrderStatus } from "@/lib/api/seller-panel/types";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  NEW: "Yangi",
  CONFIRMED: "Tasdiqlangan",
  PREPARING: "Tayyorlanmoqda",
  COMPLETED: "Bajarildi",
  CANCELLED: "Bekor qilindi",
};

export const ORDER_STATUS_TONE: Record<OrderStatus, "neutral" | "accent" | "success" | "danger" | "info"> = {
  NEW: "neutral",
  CONFIRMED: "info",
  PREPARING: "accent",
  COMPLETED: "success",
  CANCELLED: "danger",
};
