"use client";

import { useQuery } from "@tanstack/react-query";
import { sellerKeys } from "../keys";
import { fetchReturn } from "@/lib/api/seller-panel/returns";

export function useReturn(id: string) {
  return useQuery({
    queryKey: sellerKeys.returns.detail(id),
    queryFn: () => fetchReturn(id),
    enabled: Boolean(id),
  });
}
