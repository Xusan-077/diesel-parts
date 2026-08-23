"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { sellerKeys } from "../keys";
import { fetchCustomers } from "@/lib/api/seller-panel/customers";
import type { CustomersQuery } from "@/lib/api/seller-panel/types";

export function useCustomers(query: CustomersQuery) {
  return useQuery({
    queryKey: sellerKeys.customers.list(query),
    queryFn: () => fetchCustomers(query),
    placeholderData: keepPreviousData,
  });
}
