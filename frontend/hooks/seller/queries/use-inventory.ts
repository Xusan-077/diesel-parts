"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { sellerKeys } from "../keys";
import { fetchInventory, fetchStockMovements } from "@/lib/api/seller-panel/inventory";
import type { InventoryQuery, MovementsQuery } from "@/lib/api/seller-panel/types";

export function useInventory(query: InventoryQuery) {
  return useQuery({
    queryKey: sellerKeys.inventory.list(query),
    queryFn: () => fetchInventory(query),
    placeholderData: keepPreviousData,
  });
}

export function useStockMovements(query: MovementsQuery) {
  return useQuery({
    queryKey: sellerKeys.inventory.movements(query),
    queryFn: () => fetchStockMovements(query),
    placeholderData: keepPreviousData,
  });
}
