"use client";

import { useQuery } from "@tanstack/react-query";
import { sellerKeys } from "../keys";
import { fetchLowStock } from "@/lib/api/seller-panel/inventory";
import type { InventoryQuery } from "@/lib/api/seller-panel/types";

export function useLowStock(query: InventoryQuery = {}) {
  return useQuery({
    queryKey: sellerKeys.inventory.lowStock(query),
    queryFn: () => fetchLowStock(query),
  });
}
