import type {
  ReturnCondition,
  ReturnReason,
  ReturnStatus,
} from "@/lib/api/seller-panel/types";

export const RETURN_REASON_LABEL: Record<ReturnReason, string> = {
  WRONG_PRODUCT: "Noto'g'ri mahsulot",
  DEFECTIVE: "Nuqsonli",
  CHANGED_MIND: "Fikridan qaytdi",
  DAMAGED: "Shikastlangan",
  OTHER: "Boshqa",
};

export const RETURN_CONDITION_LABEL: Record<ReturnCondition, string> = {
  GOOD: "Yaxshi",
  DAMAGED: "Shikastlangan",
  USED: "Ishlatilgan",
  DEFECTIVE: "Nuqsonli",
};

/** Only `GOOD` restocks — see InventoryService.restockForReturn. */
export const RETURN_CONDITION_RESTOCKS: Record<ReturnCondition, boolean> = {
  GOOD: true,
  DAMAGED: false,
  USED: false,
  DEFECTIVE: false,
};

export const RETURN_STATUS_LABEL: Record<ReturnStatus, string> = {
  COMPLETED: "Bajarildi",
  CANCELLED: "Bekor qilindi",
};

export const RETURN_STATUS_TONE: Record<ReturnStatus, "success" | "danger"> = {
  COMPLETED: "success",
  CANCELLED: "danger",
};
