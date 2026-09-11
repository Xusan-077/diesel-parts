"use client";

import { useQuery } from "@tanstack/react-query";
import { sellerKeys } from "../keys";
import { fetchShiftHistory } from "@/lib/api/seller-panel/cashier";

export function useShiftHistory(limit = 10) {
  return useQuery({
    queryKey: sellerKeys.cashier.history(limit),
    queryFn: () => fetchShiftHistory(limit),
  });
}
