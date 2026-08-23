"use client";

import { useQuery } from "@tanstack/react-query";
import { sellerKeys } from "../keys";
import {
  fetchDashboardSummary,
  fetchOrdersChart,
  fetchSalesChart,
  fetchTopProducts,
} from "@/lib/api/seller-panel/dashboard";
import type { DateRangeQuery } from "@/lib/api/seller-panel/types";

export function useDashboardSummary() {
  return useQuery({
    queryKey: sellerKeys.dashboard.summary(),
    queryFn: fetchDashboardSummary,
  });
}

export function useSalesChart(range: DateRangeQuery = {}) {
  return useQuery({
    queryKey: sellerKeys.dashboard.sales(range),
    queryFn: () => fetchSalesChart(range),
  });
}

export function useOrdersChart(range: DateRangeQuery = {}) {
  return useQuery({
    queryKey: sellerKeys.dashboard.orders(range),
    queryFn: () => fetchOrdersChart(range),
  });
}

export function useTopProducts() {
  return useQuery({
    queryKey: sellerKeys.dashboard.topProducts(),
    queryFn: fetchTopProducts,
  });
}
