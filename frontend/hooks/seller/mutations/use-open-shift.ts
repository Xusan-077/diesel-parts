"use client";

import { sellerKeys } from "../keys";
import { useSellerMutation } from "../use-seller-mutation";
import { openShift } from "@/lib/api/seller-panel/cashier";
import type {
  CashierShift,
  OpenShiftInput,
} from "@/lib/api/seller-panel/types";

export function useOpenShift() {
  return useSellerMutation<OpenShiftInput, CashierShift>({
    run: openShift,
    invalidates: [sellerKeys.cashier.all],
    success: "Smena ochildi",
    failure: "Smenani ochib bo'lmadi",
  });
}
