import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from '../../generated/prisma/client';
import { PeriodQueryDto } from './dto/period-query.dto';

/**
 * The director analytics screen's queries — ported from root's
 * `lib/api/analytics-repository.ts`/`analytics-detail-repository.ts` (Task
 * 23). Deliberately separate from `ReportsService`/`DashboardService`:
 * those serve the seller panel's own self-scoped dashboard (one seller's own
 * orders), not a director's shop-wide view, and share only surface-level
 * similarity (both total up orders) — merging them would mean either
 * leaking every seller's figures into their own dashboard or bolting a
 * scope check onto a screen that was never meant to have one.
 *
 * Root's `PENDING` status reads as this schema's `NEW` (ported note, still
 * accurate per the consolidation plan's Part 1 reconciliation #5); this
 * schema also has `PREPARING`, which root has no concept of and which
 * counts as "still moving" everywhere root's DRAFT/PENDING/CONFIRMED did.
 *
 * `Order.sellerId` is a FK straight to `User.id` (production's shape — the
 * re-added `Seller` model is a separate optional profile with no `orders`
 * back-relation), so seller-grouped queries join a name directly off the
 * grouped `sellerId`. `Inquiry.assignedSellerId` likewise points at `User.id`.
 */
const REVENUE_STATUSES: OrderStatus[] = [OrderStatus.COMPLETED];
const PIPELINE_STATUSES: OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.NEW,
];
const OPEN_STATUSES: OrderStatus[] = [
  OrderStatus.DRAFT,
  OrderStatus.NEW,
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
];

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export interface DayPoint {
  day: string;
  value: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** One point per day across `days`, starting at `from` — a day with nothing is a real zero, not a gap. */
function fillDays(
  from: Date,
  days: number,
  totals: ReadonlyMap<string, number>,
): DayPoint[] {
  const points: DayPoint[] = [];
  for (let index = 0; index < days; index += 1) {
    const day = dayKey(new Date(from.getTime() + index * DAY_MS));
    points.push({ day, value: totals.get(day) ?? 0 });
  }
  return points;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private async sellerNamesByUserId(): Promise<Map<string, string>> {
    const sellers = await this.prisma.user.findMany({
      where: { role: 'SELLER' },
      select: { id: true, name: true },
    });
    return new Map(sellers.map((s) => [s.id, s.name]));
  }

  private async totalsBetween(from: Date, to: Date) {
    const result = await this.prisma.order.aggregate({
      where: {
        status: { in: REVENUE_STATUSES },
        createdAt: { gte: from, lt: to },
      },
      _sum: { totalAmount: true },
      _count: { _all: true },
    });
    return {
      revenue: Number(result._sum?.totalAmount ?? 0),
      orders: result._count?._all ?? 0,
    };
  }

  async salesSummary(query: PeriodQueryDto) {
    const from = new Date(query.from);
    const to = new Date(query.to);
    const previousFrom = new Date(query.previousFrom ?? query.from);
    const previousTo = new Date(query.previousTo ?? query.to);

    const [current, previous, pipeline] = await Promise.all([
      this.totalsBetween(from, to),
      this.totalsBetween(previousFrom, previousTo),
      this.prisma.order.aggregate({
        where: { status: { in: PIPELINE_STATUSES } },
        _sum: { totalAmount: true },
      }),
    ]);

    return {
      current,
      previous,
      revenueChange: percentChange(current.revenue, previous.revenue),
      ordersChange: percentChange(current.orders, previous.orders),
      averageOrderValue:
        current.orders === 0 ? 0 : current.revenue / current.orders,
      pipelineValue: Number(pipeline._sum?.totalAmount ?? 0),
    };
  }

  async revenueSeries(query: PeriodQueryDto) {
    const from = new Date(query.from);
    const to = new Date(query.to);
    const previousFrom = new Date(query.previousFrom ?? query.from);
    const days = query.days ?? 1;

    const [currentRows, previousRows] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          status: { in: REVENUE_STATUSES },
          createdAt: { gte: from, lt: to },
        },
        select: { createdAt: true, totalAmount: true },
      }),
      this.prisma.order.findMany({
        where: {
          status: { in: REVENUE_STATUSES },
          createdAt: { gte: previousFrom, lt: from },
        },
        select: { createdAt: true, totalAmount: true },
      }),
    ]);

    const bucket = (rows: { createdAt: Date; totalAmount: unknown }[]) => {
      const totals = new Map<string, number>();
      for (const row of rows) {
        const key = dayKey(row.createdAt);
        totals.set(key, (totals.get(key) ?? 0) + Number(row.totalAmount));
      }
      return totals;
    };

    const currentFilled = fillDays(from, days, bucket(currentRows));
    const previousFilled = fillDays(previousFrom, days, bucket(previousRows));

    return {
      current: currentFilled,
      previous: previousFilled.map((point, index) => ({
        day: currentFilled[index]?.day ?? point.day,
        value: point.value,
      })),
    };
  }

  async sellerPerformance(query: PeriodQueryDto) {
    const from = new Date(query.from);
    const to = new Date(query.to);

    const grouped = await this.prisma.order.groupBy({
      by: ['sellerId'],
      where: {
        status: { in: REVENUE_STATUSES },
        createdAt: { gte: from, lt: to },
      },
      _sum: { totalAmount: true },
      _count: { _all: true },
    });

    const names = await this.sellerNamesByUserId();

    return grouped
      .map((row) => ({
        sellerId: row.sellerId,
        name: names.get(row.sellerId) ?? '—',
        revenue: Number(row._sum?.totalAmount ?? 0),
        orders: row._count?._all ?? 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }

  async orderStatusBreakdown(query: PeriodQueryDto) {
    const from = new Date(query.from);
    const to = new Date(query.to);

    const grouped = await this.prisma.order.groupBy({
      by: ['status'],
      where: { createdAt: { gte: from, lt: to } },
      _count: { _all: true },
    });

    const countOf = (status: OrderStatus) =>
      grouped.find((row) => row.status === status)?._count?._all ?? 0;

    return {
      completed: countOf(OrderStatus.COMPLETED),
      open: OPEN_STATUSES.reduce((sum, status) => sum + countOf(status), 0),
      cancelled: countOf(OrderStatus.CANCELLED),
    };
  }

  async recentOrders(limit: number) {
    const rows = await this.prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
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

  async dashboardCounts() {
    const [newInquiries, pendingDiscounts, activeSellers] = await Promise.all([
      this.prisma.inquiry.count({ where: { status: 'NEW' } }),
      this.prisma.discountRequest.count({ where: { status: 'PENDING' } }),
      this.prisma.user.count({ where: { role: 'SELLER', isActive: true } }),
    ]);
    return { newInquiries, pendingDiscounts, activeSellers };
  }

  /** All three measures (revenue/orders/average) in one pass, current vs previous. */
  async salesSeries(query: PeriodQueryDto) {
    const from = new Date(query.from);
    const to = new Date(query.to);
    const previousFrom = new Date(query.previousFrom ?? query.from);
    const days = query.days ?? 1;

    const [currentRows, previousRows] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          status: { in: REVENUE_STATUSES },
          createdAt: { gte: from, lt: to },
        },
        select: { createdAt: true, totalAmount: true },
      }),
      this.prisma.order.findMany({
        where: {
          status: { in: REVENUE_STATUSES },
          createdAt: { gte: previousFrom, lt: from },
        },
        select: { createdAt: true, totalAmount: true },
      }),
    ]);

    const perDay = (rows: { createdAt: Date; totalAmount: unknown }[]) => {
      const revenue = new Map<string, number>();
      const orders = new Map<string, number>();
      for (const row of rows) {
        const key = dayKey(row.createdAt);
        revenue.set(key, (revenue.get(key) ?? 0) + Number(row.totalAmount));
        orders.set(key, (orders.get(key) ?? 0) + 1);
      }
      return { revenue, orders };
    };

    const current = perDay(currentRows);
    const previous = perDay(previousRows);

    const currentRevenue = fillDays(from, days, current.revenue);
    const previousRevenue = fillDays(previousFrom, days, previous.revenue).map(
      (point, i) => ({
        day: currentRevenue[i]?.day ?? point.day,
        value: point.value,
      }),
    );
    const currentOrders = fillDays(from, days, current.orders);
    const previousOrders = fillDays(previousFrom, days, previous.orders).map(
      (point, i) => ({
        day: currentOrders[i]?.day ?? point.day,
        value: point.value,
      }),
    );

    const currentTotalRevenue = currentRows.reduce(
      (sum, r) => sum + Number(r.totalAmount),
      0,
    );
    const previousTotalRevenue = previousRows.reduce(
      (sum, r) => sum + Number(r.totalAmount),
      0,
    );
    const currentTotalOrders = currentRows.length;
    const previousTotalOrders = previousRows.length;
    const currentAverage =
      currentTotalOrders === 0 ? 0 : currentTotalRevenue / currentTotalOrders;
    const previousAverage =
      previousTotalOrders === 0
        ? 0
        : previousTotalRevenue / previousTotalOrders;

    const currentAverageSeries = currentRevenue.map((point, i) => ({
      day: point.day,
      value:
        currentOrders[i].value === 0 ? 0 : point.value / currentOrders[i].value,
    }));
    const previousAverageSeries = previousRevenue.map((point, i) => ({
      day: point.day,
      value:
        previousOrders[i].value === 0
          ? 0
          : point.value / previousOrders[i].value,
    }));

    return {
      revenue: {
        current: currentRevenue,
        previous: previousRevenue,
        currentTotal: currentTotalRevenue,
        previousTotal: previousTotalRevenue,
        change: percentChange(currentTotalRevenue, previousTotalRevenue),
      },
      orders: {
        current: currentOrders,
        previous: previousOrders,
        currentTotal: currentTotalOrders,
        previousTotal: previousTotalOrders,
        change: percentChange(currentTotalOrders, previousTotalOrders),
      },
      average: {
        current: currentAverageSeries,
        previous: previousAverageSeries,
        currentTotal: currentAverage,
        previousTotal: previousAverage,
        change: percentChange(currentAverage, previousAverage),
      },
    };
  }

  async productMovement(query: PeriodQueryDto, limit: number) {
    const from = new Date(query.from);
    const to = new Date(query.to);
    const window = {
      status: { in: REVENUE_STATUSES },
      createdAt: { gte: from, lt: to },
    };

    const [sold, products, lines] = await Promise.all([
      this.prisma.orderItem.groupBy({
        by: ['productId'],
        where: { order: window },
        _sum: { qty: true },
      }),
      this.prisma.product.findMany({
        where: { isActive: true },
        select: {
          id: true,
          sku: true,
          nameUz: true,
          minStock: true,
          inventories: { select: { quantity: true, reservedQuantity: true } },
        },
      }),
      this.prisma.orderItem.findMany({
        where: { order: window },
        select: { productId: true, qty: true, unitPrice: true },
      }),
    ]);

    const revenueByProduct = new Map<string, number>();
    for (const line of lines) {
      const current = revenueByProduct.get(line.productId) ?? 0;
      revenueByProduct.set(
        line.productId,
        current + Number(line.unitPrice) * line.qty,
      );
    }

    const unitsByProduct = new Map(
      sold.map((row) => [row.productId, row._sum?.qty ?? 0] as const),
    );

    const rows = products.map((product) => {
      const stock = product.inventories.reduce(
        (sum, inv) => sum + inv.quantity - inv.reservedQuantity,
        0,
      );
      const unitsSold = unitsByProduct.get(product.id) ?? 0;
      return {
        id: product.id,
        sku: product.sku,
        name: product.nameUz,
        unitsSold,
        revenue: revenueByProduct.get(product.id) ?? 0,
        stock,
        coverPeriods: unitsSold === 0 ? null : stock / unitsSold,
      };
    });

    return {
      fastMoving: rows
        .filter((row) => row.unitsSold > 0)
        .sort((a, b) => b.unitsSold - a.unitsSold || b.revenue - a.revenue)
        .slice(0, limit),
      deadStock: rows
        .filter((row) => row.unitsSold === 0 && row.stock > 0)
        .sort((a, b) => b.stock - a.stock)
        .slice(0, limit),
    };
  }

  async sellerScorecards(query: PeriodQueryDto) {
    const from = new Date(query.from);
    const to = new Date(query.to);
    const window = { gte: from, lt: to };

    const [orders, sellers, inquiries, converted] = await Promise.all([
      this.prisma.order.groupBy({
        by: ['sellerId', 'status'],
        where: { createdAt: window },
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),
      this.prisma.user.findMany({
        where: { role: 'SELLER' },
        select: { id: true, name: true },
      }),
      this.prisma.inquiry.groupBy({
        by: ['assignedSellerId'],
        where: { createdAt: window, assignedSellerId: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.order.findMany({
        where: { createdAt: window, inquiryId: { not: null } },
        select: { sellerId: true, inquiryId: true },
      }),
    ]);

    const inquiryCount = new Map(
      inquiries.map(
        (row) => [row.assignedSellerId ?? '', row._count?._all ?? 0] as const,
      ),
    );

    // One inquiry can only be converted once, even if several orders were raised against it.
    const convertedByUserId = new Map<string, Set<string>>();
    for (const order of converted) {
      if (order.inquiryId === null) continue;
      const set = convertedByUserId.get(order.sellerId) ?? new Set<string>();
      set.add(order.inquiryId);
      convertedByUserId.set(order.sellerId, set);
    }

    return sellers
      .map((seller) => {
        const rows = orders.filter((row) => row.sellerId === seller.id);

        const countOf = (status: string) =>
          rows.find((row) => row.status === status)?._count?._all ?? 0;

        const revenue = rows
          .filter((row) =>
            (REVENUE_STATUSES as readonly string[]).includes(row.status),
          )
          .reduce(
            (total, row) => total + Number(row._sum?.totalAmount ?? 0),
            0,
          );

        const completedOrders = countOf(OrderStatus.COMPLETED);
        const cancelledOrders = countOf(OrderStatus.CANCELLED);
        const totalOrders = rows.reduce(
          (total, row) => total + (row._count?._all ?? 0),
          0,
        );
        const assigned = inquiryCount.get(seller.id) ?? 0;
        const won = convertedByUserId.get(seller.id)?.size ?? 0;

        return {
          sellerId: seller.id,
          name: seller.name,
          revenue,
          completedOrders,
          cancelledOrders,
          totalOrders,
          averageOrderValue:
            completedOrders === 0 ? 0 : revenue / completedOrders,
          cancelledRate:
            totalOrders === 0 ? 0 : (cancelledOrders / totalOrders) * 100,
          inquiries: assigned,
          conversionRate: assigned === 0 ? 0 : (won / assigned) * 100,
        };
      })
      .filter((row) => row.totalOrders > 0 || row.inquiries > 0)
      .sort((a, b) => b.revenue - a.revenue);
  }

  async customerAnalytics(query: PeriodQueryDto, limit: number) {
    const from = new Date(query.from);
    const to = new Date(query.to);

    const inWindow = await this.prisma.order.findMany({
      where: {
        status: { in: REVENUE_STATUSES },
        createdAt: { gte: from, lt: to },
      },
      select: {
        customerId: true,
        totalAmount: true,
        customer: { select: { id: true, name: true, company: true } },
      },
    });

    const customerIds = [...new Set(inWindow.map((order) => order.customerId))];

    const earlier = await this.prisma.order.groupBy({
      by: ['customerId'],
      where: {
        status: { in: REVENUE_STATUSES },
        createdAt: { lt: from },
        customerId: { in: customerIds },
      },
      _count: { _all: true },
    });

    const hadOrderedBefore = new Set(earlier.map((row) => row.customerId));

    const totals = new Map<
      string,
      {
        id: string;
        name: string;
        company: string | null;
        orders: number;
        revenue: number;
      }
    >();
    for (const order of inWindow) {
      const existing = totals.get(order.customerId) ?? {
        id: order.customer.id,
        name: order.customer.name,
        company: order.customer.company,
        orders: 0,
        revenue: 0,
      };
      existing.orders += 1;
      existing.revenue += Number(order.totalAmount);
      totals.set(order.customerId, existing);
    }

    return {
      newCustomers: customerIds.filter((id) => !hadOrderedBefore.has(id))
        .length,
      returningCustomers: customerIds.filter((id) => hadOrderedBefore.has(id))
        .length,
      topCustomers: [...totals.values()]
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, limit),
    };
  }
}
