"use client";

import { sellerKeys } from "../keys";
import { useSellerMutation } from "../use-seller-mutation";
import { updateOrderStatus } from "@/lib/api/seller-panel/orders";
import type { Order, OrderStatus } from "@/lib/api/seller-panel/types";

export function useUpdateOrderStatus() {
  return useSellerMutation<{ id: string; status: OrderStatus }, Order>({
    run: ({ id, status }) => updateOrderStatus(id, status),
    invalidates: [sellerKeys.orders.all, sellerKeys.dashboard.all],
    success: "Buyurtma holati yangilandi",
    failure: "Buyurtma holatini yangilab bo'lmadi",
  });
}
