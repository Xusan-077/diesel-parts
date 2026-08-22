import "server-only";
import { prisma } from "@/lib/db";
import { dayKey, fillDays, percentChange, type DayPoint, type Period } from "@/lib/analytics/period";
import type { OrderStatus } from "@/prisma/generated/prisma/enums";

/**
 * Money is booked when an order completes, not when it is agreed. CONFIRMED and
 * PENDING orders are real intent but not yet income, so they are reported
 * separately as pipeline rather than folded into revenue.
 */
const REVENUE_STATUSES: OrderStatus[] = ["COMPLETED"];
const PIPELINE_STATUSES: OrderStatus[] = ["CONFIRMED", "PENDING"];

export interface Totals {
  revenue: number;
  orders: number;
}

async function totalsBetween(from: Date, to: Date): Promise<Totals> {
  const result = await prisma.order.aggregate({
    where: { status: { in: REVENUE_STATUSES }, createdAt: { gte: from, lt: to } },
    _sum: { totalAmount: true },
    _count: { _all: true },
  });

  return {
    revenue: Number(result._sum.totalAmount ?? 0),
    orders: result._count._all,
  };
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
  const [current, previous, pipeline] = await Promise.all([
    totalsBetween(period.from, period.to),
    totalsBetween(period.previousFrom, period.previousTo),
    prisma.order.aggregate({
      where: { status: { in: PIPELINE_STATUSES } },
      _sum: { totalAmount: true },
    }),
  ]);

  return {
    current,
    previous,
    revenueChange: percentChange(current.revenue, previous.revenue),
    ordersChange: percentChange(current.orders, previous.orders),
    averageOrderValue: current.orders === 0 ? 0 : current.revenue / current.orders,
    pipelineValue: Number(pipeline._sum.totalAmount ?? 0),
  };
}

export interface RevenueSeries {
  current: DayPoint[];
  /** The comparison window, re-indexed onto the current window's day slots. */
  previous: DayPoint[];
}

/**
 * Both windows come back aligned to the same x positions, so day 1 of this
 * period sits above day 1 of the last one. Without that the two lines would be
 * drawn against different dates and the comparison would be meaningless.
 */
export async function getRevenueSeries(period: Period): Promise<RevenueSeries> {
  const [currentRows, previousRows] = await Promise.all([
    prisma.order.findMany({
      where: {
        status: { in: REVENUE_STATUSES },
        createdAt: { gte: period.from, lt: period.to },
      },
      select: { createdAt: true, totalAmount: true },
    }),
    prisma.order.findMany({
      where: {
        status: { in: REVENUE_STATUSES },
        createdAt: { gte: period.previousFrom, lt: period.previousTo },
      },
      select: { createdAt: true, totalAmount: true },
    }),
  ]);

  function bucket(rows: { createdAt: Date; totalAmount: unknown }[]): Map<string, number> {
    const totals = new Map<string, number>();
    for (const row of rows) {
      const key = dayKey(row.createdAt);
      totals.set(key, (totals.get(key) ?? 0) + Number(row.totalAmount));
    }
    return totals;
  }

  const previousFilled = fillDays(period.previousFrom, period.days, bucket(previousRows));
  const currentFilled = fillDays(period.from, period.days, bucket(currentRows));

  return {
    current: currentFilled,
    // Relabelled onto the current window's days so both series share an x-axis.
    previous: previousFilled.map((point, index) => ({
      day: currentFilled[index]?.day ?? point.day,
      value: point.value,
    })),
  };
}

export interface SellerPerformance {
  sellerId: string;
  name: string;
  revenue: number;
  orders: number;
}

export async function getSellerPerformance(period: Period): Promise<SellerPerformance[]> {
  const grouped = await prisma.order.groupBy({
    by: ["sellerId"],
    where: { status: { in: REVENUE_STATUSES }, createdAt: { gte: period.from, lt: period.to } },
    _sum: { totalAmount: true },
    _count: { _all: true },
  });

  const sellers = await prisma.user.findMany({
    where: { id: { in: grouped.map((row) => row.sellerId) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(sellers.map((seller) => [seller.id, seller.name]));

  return grouped
    .map((row) => ({
      sellerId: row.sellerId,
      name: nameById.get(row.sellerId) ?? "—",
      revenue: Number(row._sum.totalAmount ?? 0),
      orders: row._count._all,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export interface LowStockProduct {
  id: string;
  sku: string;
  name: string;
  stock: number;
  minStock: number;
}

/**
 * `stock <= minStock` is a column-to-column comparison, which Prisma's `where`
 * cannot express, so the threshold is applied after a bounded read of the
 * products that could possibly qualify.
 */
export async function getLowStockProducts(limit: number = 8): Promise<LowStockProduct[]> {
  const rows = await prisma.product.findMany({
    where: { isActive: true, stockStatus: { in: ["limited", "out_of_stock"] } },
    select: { id: true, sku: true, nameUz: true, stock: true, minStock: true },
    orderBy: { stock: "asc" },
    take: limit,
  });

  return rows.map((row) => ({
    id: row.id,
    sku: row.sku,
    name: row.nameUz,
    stock: row.stock,
    minStock: row.minStock,
  }));
}

export interface OrderStatusBreakdown {
  completed: number;
  open: number;
  cancelled: number;
}

/**
 * How the period's orders ended up, as three counts.
 *
 * Three buckets and not five, because the five statuses answer two different
 * questions. `getSalesSummary` already splits them by *money* — banked versus
 * in flight — and repeating that split here would draw the same fact twice on
 * one screen. What the ring answers is the other question: of everything
 * opened in this window, what share landed, what is still moving, and what was
 * lost. DRAFT, PENDING and CONFIRMED are all "still moving" from that angle.
 *
 * Counted by `createdAt` in the window, so an order raised last month and
 * completed this one is not claimed by this period.
 */
export async function getOrderStatusBreakdown(period: Period): Promise<OrderStatusBreakdown> {
  const grouped = await prisma.order.groupBy({
    by: ["status"],
    where: { createdAt: { gte: period.from, lt: period.to } },
    _count: { _all: true },
  });

  const countOf = (status: OrderStatus) =>
    grouped.find((row) => row.status === status)?._count._all ?? 0;

  return {
    completed: countOf("COMPLETED"),
    open: countOf("DRAFT") + countOf("PENDING") + countOf("CONFIRMED"),
    cancelled: countOf("CANCELLED"),
  };
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

/**
 * The last few orders across every status.
 *
 * Deliberately unfiltered. The revenue figures above it only count COMPLETED,
 * which is correct for money and wrong for "what has been happening" — a
 * director scanning this block wants to see the draft raised an hour ago as
 * much as the sale that closed yesterday.
 */
export async function getRecentOrders(limit: number = 6): Promise<RecentOrder[]> {
  const rows = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      totalAmount: true,
      createdAt: true,
      customer: { select: { name: true } },
      seller: { select: { name: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    orderNumber: row.orderNumber,
    customerName: row.customer.name,
    sellerName: row.seller.name,
    status: row.status,
    total: Number(row.totalAmount),
    createdAt: row.createdAt,
  }));
}

export interface DashboardCounts {
  newInquiries: number;
  pendingDiscounts: number;
  activeSellers: number;
}

export async function getDashboardCounts(): Promise<DashboardCounts> {
  const [newInquiries, pendingDiscounts, activeSellers] = await Promise.all([
    prisma.inquiry.count({ where: { status: "NEW" } }),
    prisma.discountRequest.count({ where: { status: "PENDING" } }),
    prisma.user.count({ where: { role: "SELLER", isActive: true } }),
  ]);

  return { newInquiries, pendingDiscounts, activeSellers };
}
