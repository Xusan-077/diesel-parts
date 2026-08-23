"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { sellerKeys } from "../keys";
import { fetchOrders } from "@/lib/api/seller-panel/orders";
import type { OrdersQuery } from "@/lib/api/seller-panel/types";

export function useOrders(query: OrdersQuery) {
  return useQuery({
    queryKey: sellerKeys.orders.list(query),
    queryFn: () => fetchOrders(query),
    placeholderData: keepPreviousData,
  });
}
