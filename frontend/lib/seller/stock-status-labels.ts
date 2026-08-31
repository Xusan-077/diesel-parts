import type { StockStatus } from "@/lib/api/seller-panel/types";

export const STOCK_STATUS_LABEL: Record<StockStatus, string> = {
  IN_STOCK: "Mavjud",
  LOW_STOCK: "Kam qoldi",
  OUT_OF_STOCK: "Tugagan",
};

export const STOCK_STATUS_TONE: Record<StockStatus, "success" | "warning" | "danger"> = {
  IN_STOCK: "success",
  LOW_STOCK: "warning",
  OUT_OF_STOCK: "danger",
};
