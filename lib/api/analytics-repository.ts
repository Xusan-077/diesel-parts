import "server-only";
import { backendRequest } from "./backend-client";
import { getStaffSession } from "@/lib/auth/staff-session";
import { toRootStatus } from "./order-repository";
import type { DayPoint, Period } from "@/lib/analytics/period";
import type { OrderStatus } from "@/prisma/generated/prisma/enums";

async function accessToken(): Promise<string | undefined> {
  const session = await getStaffSession();
  return session?.accessToken;
}

/** The from/to/previousFrom/previousTo/days query every period-shaped endpoint takes. */
function periodQuery(period: Period) {
  return {
    from: period.from.toISOString(),
    to: period.to.toISOString(),
    previousFrom: period.previousFrom.toISOString(),
    previousTo: period.previousTo.toISOString(),
    days: period.days,
  };
}

export interface Totals {
  revenue: number;
  orders: number;
}

export interface SalesSummary {
  current: Totals;
  previous: Totals;
  revenueChange: number | null;
  ordersChange: number | null;
  averageOrderValue: number;
  pipelineValue: number;
}

export async function getSalesSummary(period: Period): Promise<SalesSummary> {
  return backendRequest<SalesSummary>("/analytics/sales-summary", {
    accessToken: await accessToken(),
    query: periodQuery(period),
  });
}

export interface RevenueSeries {
  current: DayPoint[];
  previous: DayPoint[];
}

export async function getRevenueSeries(period: Period): Promise<RevenueSeries> {
  return backendRequest<RevenueSeries>("/analytics/revenue-series", {
    accessToken: await accessToken(),
    query: periodQuery(period),
  });
}

export interface SellerPerformance {
  sellerId: string;
  name: string;
  revenue: number;
  orders: number;
}

export async function getSellerPerformance(period: Period): Promise<SellerPerformance[]> {
  return backendRequest<SellerPerformance[]>("/analytics/seller-performance", {
    accessToken: await accessToken(),
    query: periodQuery(period),
  });
}

export interface LowStockProduct {
  id: string;
  sku: string;
  name: string;
  stock: number;
  minStock: number;
}

interface BackendLowStockRow {
  id: string;
  sku: string;
  nameUz: string;
  availableQuantity: number;
  minStock: number;
  stockStatus: string;
}

/**
 * Read from backend/'s existing admin product list rather than a dedicated
 * analytics endpoint — the same "one bounded read of a small catalog" the
 * price-bounds/stock-overview rewires already settled on (Task 15), and this
 * needs the same active-catalog snapshot they do.
 */
export async function getLowStockProducts(limit: number = 8): Promise<LowStockProduct[]> {
  const result = await backendRequest<{ data: BackendLowStockRow[] }>("/products", {
    accessToken: await accessToken(),
    query: { isActive: "true", limit: 100 },
  });

  return result.data
    .filter((row) => row.stockStatus === "limited" || row.stockStatus === "out_of_stock")
    .sort((a, b) => a.availableQuantity - b.availableQuantity)
    .slice(0, limit)
    .map((row) => ({
      id: row.id,
      sku: row.sku,
      name: row.nameUz,
      stock: row.availableQuantity,
      minStock: row.minStock,
    }));
}

export interface OrderStatusBreakdown {
  completed: number;
  open: number;
  cancelled: number;
}

export async function getOrderStatusBreakdown(period: Period): Promise<OrderStatusBreakdown> {
  return backendRequest<OrderStatusBreakdown>("/analytics/order-status-breakdown", {
    accessToken: await accessToken(),
    query: periodQuery(period),
  });
}

export interface RecentOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  sellerName: string;
  status: OrderStatus;
  total: number;
  createdAt: Date;
}

/** backend/'s raw row — `status` is its own wider vocabulary (NEW, PREPARING) before translation. */
interface BackendRecentOrder extends Omit<RecentOrder, "createdAt" | "status"> {
  status: string;
  createdAt: string;
}

export async function getRecentOrders(limit: number = 6): Promise<RecentOrder[]> {
  const rows = await backendRequest<BackendRecentOrder[]>("/analytics/recent-orders", {
    accessToken: await accessToken(),
    query: { limit },
  });

  return rows.map((row) => ({
    ...row,
    status: toRootStatus(row.status),
    createdAt: new Date(row.createdAt),
  }));
}

export interface DashboardCounts {
  newInquiries: number;
  pendingDiscounts: number;
  activeSellers: number;
}

export async function getDashboardCounts(): Promise<DashboardCounts> {
  return backendRequest<DashboardCounts>("/analytics/dashboard-counts", {
    accessToken: await accessToken(),
  });
}
