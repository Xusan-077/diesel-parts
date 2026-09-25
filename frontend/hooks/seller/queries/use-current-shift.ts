"use client";

import { useQuery } from "@tanstack/react-query";
import { sellerKeys } from "../keys";
import { fetchCurrentShift } from "@/lib/api/seller-panel/cashier";

export function useCurrentShift() {
  return useQuery({
    queryKey: sellerKeys.cashier.current(),
    queryFn: fetchCurrentShift,
    staleTime: 0,
    refetchInterval: 30_000,
  });
}
