"use client";
import { useQuery } from "@tanstack/react-query";
import { sellerKeys } from "../keys";
import { fetchReturns } from "@/lib/api/seller-panel/returns";

export function useSaleReturns(orderId?: string) {
  return useQuery({
    queryKey: [...sellerKeys.returns.all, "sale", orderId],
    enabled: Boolean(orderId),
    queryFn: async () => {
      const first = await fetchReturns({ orderId, page: 1, limit: 100 });
      const all = [...first.data];
      for (let page = 2; page <= first.meta.totalPages; page++) {
        all.push(...(await fetchReturns({ orderId, page, limit: 100 })).data);
      }
      return all;
    },
  });
}
