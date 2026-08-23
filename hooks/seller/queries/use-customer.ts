"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { sellerKeys } from "../keys";
import { fetchCustomer, fetchCustomerOrders } from "@/lib/api/seller-panel/customers";

export function useCustomer(id: string) {
  return useQuery({
    queryKey: sellerKeys.customers.detail(id),
    queryFn: () => fetchCustomer(id),
    enabled: Boolean(id),
  });
}

export function useCustomerOrders(id: string, page: number = 1) {
  return useQuery({
    queryKey: sellerKeys.customers.orders(id, page),
    queryFn: () => fetchCustomerOrders(id, { page }),
    enabled: Boolean(id),
    placeholderData: keepPreviousData,
  });
}
