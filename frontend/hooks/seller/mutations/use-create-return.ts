"use client";

import { sellerKeys } from "../keys";
import { useSellerMutation } from "../use-seller-mutation";
import { createReturn } from "@/lib/api/seller-panel/returns";
import type { CreateReturnInput, Return } from "@/lib/api/seller-panel/types";

export function useCreateReturn() {
  return useSellerMutation<CreateReturnInput, Return>({
    run: createReturn,
    invalidates: [
      sellerKeys.returns.all,
      sellerKeys.orders.all,
      sellerKeys.cashier.all,
      sellerKeys.dashboard.all,
      sellerKeys.inventory.all,
      sellerKeys.products.all,
    ],
    success: (_vars, data) => `Qaytarish yaratildi — ${data.returnNumber}`,
    failure: "Qaytarishni yaratib bo'lmadi",
  });
}
