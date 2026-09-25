"use client";

import { sellerKeys } from "../keys";
import { useSellerMutation } from "../use-seller-mutation";
import {
  createPayment,
  type CreatePaymentInput,
} from "@/lib/api/seller-panel/payments";
import type { Payment } from "@/lib/api/seller-panel/types";

/** No `success` toast — one step in the New Sale checkout sequence, see use-create-order.ts. */
export function useRecordPayment() {
  return useSellerMutation<CreatePaymentInput, Payment>({
    run: createPayment,
    invalidates: [sellerKeys.orders.all, sellerKeys.cashier.all],
    failure: "To'lovni yozib bo'lmadi",
  });
}
