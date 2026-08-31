"use client";

import { sellerKeys } from "../keys";
import { useSellerMutation } from "../use-seller-mutation";
import { cancelOrder } from "@/lib/api/seller-panel/orders";
import type { Order } from "@/lib/api/seller-panel/types";

export function useCancelOrder() {
  return useSellerMutation<{ id: string }, Order>({
    run: ({ id }) => cancelOrder(id),
    invalidates: [sellerKeys.orders.all, sellerKeys.dashboard.all],
    success: "Buyurtma bekor qilindi",
    failure: "Buyurtmani bekor qilib bo'lmadi",
  });
}
