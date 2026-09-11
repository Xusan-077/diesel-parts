"use client";

import { sellerKeys } from "../keys";
import { useSellerMutation } from "../use-seller-mutation";
import { createCustomer, type CreateCustomerInput } from "@/lib/api/seller-panel/customers";
import type { Customer } from "@/lib/api/seller-panel/types";

export function useCreateCustomer() {
  return useSellerMutation<CreateCustomerInput, Customer>({
    run: createCustomer,
    invalidates: [sellerKeys.customers.all],
    success: "Mijoz qo'shildi",
    failure: "Mijozni qo'shib bo'lmadi",
  });
}
