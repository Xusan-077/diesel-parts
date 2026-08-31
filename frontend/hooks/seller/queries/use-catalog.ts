"use client";

import { useQuery } from "@tanstack/react-query";
import { sellerKeys } from "../keys";
import { fetchBrands, fetchCategories, fetchWarehouses } from "@/lib/api/seller-panel/catalog";

export function useCategories() {
  return useQuery({
    queryKey: sellerKeys.catalog.categories(),
    queryFn: fetchCategories,
    staleTime: 5 * 60_000,
  });
}

export function useBrands() {
  return useQuery({
    queryKey: sellerKeys.catalog.brands(),
    queryFn: fetchBrands,
    staleTime: 5 * 60_000,
  });
}

export function useWarehouses() {
  return useQuery({
    queryKey: sellerKeys.catalog.warehouses(),
    queryFn: fetchWarehouses,
    staleTime: 5 * 60_000,
  });
}
