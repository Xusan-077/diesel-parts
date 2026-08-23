import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { OrderStatus, Prisma, Role } from '../../generated/prisma/client';
import { DateRangeDto } from './dto/date-range.dto';

const OPEN_STATUSES: OrderStatus[] = [
  OrderStatus.NEW,
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
];

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private orderScope(actor: AuthenticatedUser): Prisma.OrderWhereInput {
    return actor.role === Role.SELLER && actor.sellerId
      ? { sellerId: actor.sellerId }
      : {};
  }

  private percentChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  async summary(actor: AuthenticatedUser) {
    const scope = this.orderScope(actor);
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const elapsedMs = now.getTime() - todayStart.getTime();
    const priorStart = new Date(todayStart.getTime() - 86_400_000);
    const priorEnd = new Date(priorStart.getTime() + elapsedMs);

    const [
      todaySales,
      priorSales,
      todayOrders,
      priorOrders,
      pendingCount,
      todayCustomers,
      priorCustomers,
    ] = await Promise.all([
      this.prisma.order.aggregate({
        where: {
          ...scope,
          createdAt: { gte: todayStart, lte: now },
          status: { not: OrderStatus.CANCELLED },
        },
        _sum: { total: true },
      }),
      this.prisma.order.aggregate({
        where: {
          ...scope,
          createdAt: { gte: priorStart, lte: priorEnd },
          status: { not: OrderStatus.CANCELLED },
        },
        _sum: { total: true },
      }),
      this.prisma.order.count({
        where: { ...scope, createdAt: { gte: todayStart, lte: now } },
      }),
      this.prisma.order.count({
        where: { ...scope, createdAt: { gte: priorStart, lte: priorEnd } },
      }),
      this.prisma.order.count({
        where: { ...scope, status: { in: OPEN_STATUSES } },
      }),
      this.prisma.customer.count({
        where: { createdAt: { gte: todayStart, lte: now } },
      }),
      this.prisma.customer.count({
        where: { createdAt: { gte: priorStart, lte: priorEnd } },
      }),
    ]);

    const todaySalesTotal = Number(todaySales._sum.total ?? 0);
    const priorSalesTotal = Number(priorSales._sum.total ?? 0);

    return {
      today: {
        sales: todaySalesTotal,
        ordersCount: todayOrders,
        pendingCount,
        newCustomers: todayCustomers,
      },
      changeVsPriorPeriod: {
        salesPercent: this.percentChange(todaySalesTotal, priorSalesTotal),
        ordersPercent: this.percentChange(todayOrders, priorOrders),
        newCustomersPercent: this.percentChange(todayCustomers, priorCustomers),
      },
    };
  }

  async salesChart(actor: AuthenticatedUser, range: DateRangeDto) {
    const { from, to } = this.resolveRange(range);
    const orders = await this.prisma.order.findMany({
      where: {
        ...this.orderScope(actor),
        createdAt: { gte: from, lte: to },
        status: { not: OrderStatus.CANCELLED },
      },
      select: { createdAt: true, total: true },
    });
    return this.groupByDay(orders, (o) => Number(o.total));
  }

  async ordersChart(actor: AuthenticatedUser, range: DateRangeDto) {
    const { from, to } = this.resolveRange(range);
    const orders = await this.prisma.order.findMany({
      where: { ...this.orderScope(actor), createdAt: { gte: from, lte: to } },
      select: { createdAt: true },
    });
    return this.groupByDay(orders, () => 1);
  }

  async topProducts(actor: AuthenticatedUser, limit = 5) {
    const scope = this.orderScope(actor);
    const grouped = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where: Object.keys(scope).length ? { order: scope } : undefined,
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: limit,
    });

    const products = await this.prisma.product.findMany({
      where: { id: { in: grouped.map((g) => g.productId) } },
      select: { id: true, sku: true, nameEn: true },
    });
    const productById = new Map(products.map((p) => [p.id, p]));

    return grouped.map((g) => ({
      product: productById.get(g.productId) ?? null,
      quantitySold: g._sum.quantity ?? 0,
      revenue: Number(g._sum.total ?? 0),
    }));
  }

  private resolveRange(range: DateRangeDto) {
    const to = range.dateTo ? new Date(range.dateTo) : new Date();
    const from = range.dateFrom
      ? new Date(range.dateFrom)
      : new Date(to.getTime() - 29 * 86_400_000);
    return { from, to };
  }

  private groupByDay<T extends { createdAt: Date }>(
    rows: T[],
    value: (row: T) => number,
  ) {
    const byDay = new Map<string, number>();
    for (const row of rows) {
      const key = row.createdAt.toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + value(row));
    }
    return [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, total]) => ({ date, total }));
  }
}
