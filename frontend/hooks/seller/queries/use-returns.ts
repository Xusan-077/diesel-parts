"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { sellerKeys } from "../keys";
import { fetchReturns } from "@/lib/api/seller-panel/returns";
import type { ReturnsQuery } from "@/lib/api/seller-panel/types";

export function useReturns(
  query: ReturnsQuery,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: sellerKeys.returns.list(query),
    queryFn: () => fetchReturns(query),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}
