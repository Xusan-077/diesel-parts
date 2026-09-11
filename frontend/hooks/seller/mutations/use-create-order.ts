"use client";

import { sellerKeys } from "../keys";
import { useSellerMutation } from "../use-seller-mutation";
import { createOrder, type CreateOrderInput } from "@/lib/api/seller-panel/orders";
import type { Order } from "@/lib/api/seller-panel/types";

/**
 * No `success` toast — this is the first step of the New Sale checkout
 * sequence (create -> confirm -> pay -> complete), and the page shows one
 * combined result once every step lands rather than one toast per step.
 */
export function useCreateOrder() {
  return useSellerMutation<CreateOrderInput, Order>({
    run: createOrder,
    invalidates: [sellerKeys.orders.all, sellerKeys.dashboard.all],
    failure: "Sotuvni yaratib bo'lmadi",
  });
}
