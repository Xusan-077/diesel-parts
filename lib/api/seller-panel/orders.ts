import { sellerApiRequest } from "./client";
import type { Order, OrderStatus, OrdersQuery, Paginated } from "./types";

export function fetchOrders(query: OrdersQuery): Promise<Paginated<Order>> {
  return sellerApiRequest<Paginated<Order>>("/seller/orders", { query });
}

export function fetchOrder(id: string): Promise<Order> {
  return sellerApiRequest<Order>(`/seller/orders/${id}`);
}

export function updateOrderStatus(id: string, status: OrderStatus): Promise<Order> {
  return sellerApiRequest<Order>(`/seller/orders/${id}/status`, {
    method: "PATCH",
    body: { status },
  });
}

export function cancelOrder(id: string): Promise<Order> {
  return sellerApiRequest<Order>(`/seller/orders/${id}/cancel`, { method: "POST" });
}
