"use client";

import { useQuery } from "@tanstack/react-query";
import { sellerKeys } from "../keys";
import { fetchOrder } from "@/lib/api/seller-panel/orders";

export function useOrder(id: string) {
  return useQuery({
    queryKey: sellerKeys.orders.detail(id),
    queryFn: () => fetchOrder(id),
    enabled: Boolean(id),
  });
}
