import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from '../../generated/prisma/client';
import { DateRangeDto } from '../dashboard/dto/date-range.dto';
import { deriveStockStatus, StockStatus } from '../products/stock-status';

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
}
