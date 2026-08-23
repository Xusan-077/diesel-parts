"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { sellerKeys } from "../keys";
import { fetchProducts } from "@/lib/api/seller-panel/products";
import type { ProductsQuery } from "@/lib/api/seller-panel/types";

export function useProducts(query: ProductsQuery) {
  return useQuery({
    queryKey: sellerKeys.products.list(query),
    queryFn: () => fetchProducts(query),
    placeholderData: keepPreviousData,
  });
}
