"use client";

import { sellerKeys } from "../keys";
import { useSellerMutation } from "../use-seller-mutation";
import { closeShift } from "@/lib/api/seller-panel/cashier";
import type {
  CashierShift,
  CloseShiftInput,
} from "@/lib/api/seller-panel/types";

export function useCloseShift() {
  return useSellerMutation<CloseShiftInput, CashierShift>({
    run: closeShift,
    invalidates: [sellerKeys.cashier.all],
    success: "Smena yopildi",
    failure: "Smenani yopib bo'lmadi",
  });
}
