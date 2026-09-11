import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus, Role } from '../../generated/prisma/client';
import { DateRangeDto } from '../dashboard/dto/date-range.dto';
import { deriveStockStatus, StockStatus } from '../products/stock-status';
import type { ScopeActor } from '../common/scope';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async salesSummary(range: DateRangeDto) {
    const to = range.dateTo ? new Date(range.dateTo) : new Date();
    const from = range.dateFrom
      ? new Date(range.dateFrom)
      : new Date(to.getTime() - 29 * 86_400_000);

    const [aggregate, count] = await Promise.all([
      this.prisma.order.aggregate({
        where: {
          createdAt: { gte: from, lte: to },
          status: { not: OrderStatus.CANCELLED },
        },
        _sum: { totalAmount: true, discount: true },
      }),
      this.prisma.order.count({
        where: {
          createdAt: { gte: from, lte: to },
          status: { not: OrderStatus.CANCELLED },
        },
      }),
    ]);

    const totalSales = Number(aggregate._sum?.totalAmount ?? 0);
    return {
      range: { from, to },
      totalSales,
      totalDiscount: Number(aggregate._sum?.discount ?? 0),
      orderCount: count,
      averageOrderValue: count > 0 ? totalSales / count : 0,
    };
  }

  async inventoryStatus() {
    const inventories = await this.prisma.inventory.findMany({
      select: {
        quantity: true,
        reservedQuantity: true,
        product: { select: { minStock: true } },
      },
    });

    const counts: Record<StockStatus, number> = {
      [StockStatus.IN_STOCK]: 0,
      [StockStatus.LOW_STOCK]: 0,
      [StockStatus.OUT_OF_STOCK]: 0,
    };
    for (const inv of inventories) {
      const available = inv.quantity - inv.reservedQuantity;
      counts[deriveStockStatus(available, inv.product.minStock)] += 1;
    }
    return counts;
  }

  /**
   * A seller's own COMPLETED sales, bucketed by calendar day. Bucketed in JS
   * rather than a DB-side date-trunc — the same tradeoff `inventoryStatus`
   * above already makes, and the row count here (one shop, 30 days) is
   * nowhere near where that would start to matter.
   */
  async sellerDailySales(actor: ScopeActor, range: DateRangeDto) {
    const to = range.dateTo ? new Date(range.dateTo) : new Date();
    const from = range.dateFrom
      ? new Date(range.dateFrom)
      : new Date(to.getTime() - 29 * 86_400_000);

    const orders = await this.prisma.order.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        status: OrderStatus.COMPLETED,
        ...(actor.role === Role.SELLER ? { sellerId: actor.id } : {}),
      },
      select: { createdAt: true, totalAmount: true },
    });

    const byDay = new Map<string, { totalSales: number; orderCount: number }>();
    for (const order of orders) {
      const day = order.createdAt.toISOString().slice(0, 10);
      const bucket = byDay.get(day) ?? { totalSales: 0, orderCount: 0 };
      bucket.totalSales += Number(order.totalAmount);
      bucket.orderCount += 1;
      byDay.set(day, bucket);
    }

    const days = [...byDay.entries()]
      .map(([date, bucket]) => ({ date, ...bucket }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      range: { from, to },
      days,
      totalSales: days.reduce((sum, d) => sum + d.totalSales, 0),
      orderCount: days.reduce((sum, d) => sum + d.orderCount, 0),
    };
  }

  /** A seller's own best-selling products by units sold, over COMPLETED sales in range. */
  async sellerTopProducts(
    actor: ScopeActor,
    range: DateRangeDto,
    limit: number,
  ) {
    const to = range.dateTo ? new Date(range.dateTo) : new Date();
    const from = range.dateFrom
      ? new Date(range.dateFrom)
      : new Date(to.getTime() - 29 * 86_400_000);

    const items = await this.prisma.orderItem.findMany({
      where: {
        order: {
          createdAt: { gte: from, lte: to },
          status: OrderStatus.COMPLETED,
          ...(actor.role === Role.SELLER ? { sellerId: actor.id } : {}),
        },
      },
      select: {
        productId: true,
        productName: true,
        qty: true,
        unitPrice: true,
      },
    });

    const byProduct = new Map<
      string,
      {
        productId: string;
        productName: string;
        qtySold: number;
        revenue: number;
      }
    >();
    for (const item of items) {
      const bucket = byProduct.get(item.productId) ?? {
        productId: item.productId,
        productName: item.productName,
        qtySold: 0,
        revenue: 0,
      };
      bucket.qtySold += item.qty;
      bucket.revenue += item.qty * Number(item.unitPrice);
      byProduct.set(item.productId, bucket);
    }

    return [...byProduct.values()]
      .sort((a, b) => b.qtySold - a.qtySold)
      .slice(0, limit);
  }
}
