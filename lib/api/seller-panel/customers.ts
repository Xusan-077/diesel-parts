import { sellerApiRequest } from "./client";
import type { Customer, CustomerOrderRow, CustomersQuery, Paginated, PaginationParams } from "./types";

export function fetchCustomers(query: CustomersQuery): Promise<Paginated<Customer>> {
  return sellerApiRequest<Paginated<Customer>>("/seller/customers", { query });
}

export function fetchCustomer(id: string): Promise<Customer> {
  return sellerApiRequest<Customer>(`/seller/customers/${id}`);
}

export function fetchCustomerOrders(id: string, query: PaginationParams): Promise<Paginated<CustomerOrderRow>> {
  return sellerApiRequest<Paginated<CustomerOrderRow>>(`/seller/customers/${id}/orders`, { query });
}
