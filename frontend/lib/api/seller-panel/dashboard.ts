import { sellerApiRequest } from "./client";
import type { DashboardPoint, DashboardSummary, DateRangeQuery, TopProduct } from "./types";

export function fetchDashboardSummary(): Promise<DashboardSummary> {
  return sellerApiRequest<DashboardSummary>("/seller/dashboard");
}

export function fetchSalesChart(range: DateRangeQuery): Promise<DashboardPoint[]> {
  return sellerApiRequest<DashboardPoint[]>("/seller/dashboard/sales", { query: range });
}

export function fetchOrdersChart(range: DateRangeQuery): Promise<DashboardPoint[]> {
  return sellerApiRequest<DashboardPoint[]>("/seller/dashboard/orders", { query: range });
}

export function fetchTopProducts(): Promise<TopProduct[]> {
  return sellerApiRequest<TopProduct[]>("/seller/dashboard/top-products");
}
