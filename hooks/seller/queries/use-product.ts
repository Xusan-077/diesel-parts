"use client";

import { useQuery } from "@tanstack/react-query";
import { sellerKeys } from "../keys";
import { fetchProduct, fetchProductStock } from "@/lib/api/seller-panel/products";

export function useProduct(id: string) {
  return useQuery({
    queryKey: sellerKeys.products.detail(id),
    queryFn: () => fetchProduct(id),
    enabled: Boolean(id),
  });
}

export function useProductStock(id: string) {
  return useQuery({
    queryKey: sellerKeys.products.stock(id),
    queryFn: () => fetchProductStock(id),
    enabled: Boolean(id),
  });
}
