import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import { paginationMeta } from '../../common/dto/pagination.dto';
import { deriveStockStatus } from '../../products/stock-status';
import { QueryStockReportDto } from './dto/query-stock-report.dto';
import { QueryMovementsReportDto } from './dto/query-movements-report.dto';

function num(value: Prisma.Decimal | null): number | null {
  return value === null ? null : Number(value);
}

/** Cost per unit, most specific source first. */
function unitCost(row: {
  averageCost: Prisma.Decimal | null;
  product: {
    averageCost: Prisma.Decimal | null;
    purchasePrice: Prisma.Decimal | null;
  };
}): number {
  return (
    num(row.averageCost) ??
    num(row.product.averageCost) ??
    num(row.product.purchasePrice) ??
    0
  );
}

@Injectable()
export class WarehouseReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** On-hand, reserved, SKU count and stock value, grouped by warehouse. */
  async stock(query: QueryStockReportDto) {
    const rows = await this.prisma.inventory.findMany({
      where: query.warehouseId ? { warehouseId: query.warehouseId } : {},
      select: {
        quantity: true,
        reservedQuantity: true,
        averageCost: true,
        warehouse: { select: { id: true, name: true, code: true } },
        product: { select: { averageCost: true, purchasePrice: true } },
      },
    });

    const byWarehouse = new Map<
      string,
      {
        warehouseId: string;
        warehouseCode: string;
        warehouseName: string;
        skuCount: number;
        quantity: number;
        reservedQuantity: number;
        stockValue: number;
      }
    >();

    for (const row of rows) {
      const key = row.warehouse.id;
      const acc = byWarehouse.get(key) ?? {
        warehouseId: key,
        warehouseCode: row.warehouse.code,
        warehouseName: row.warehouse.name,
        skuCount: 0,
        quantity: 0,
        reservedQuantity: 0,
        stockValue: 0,
      };
      acc.skuCount += 1;
      acc.quantity += row.quantity;
      acc.reservedQuantity += row.reservedQuantity;
      acc.stockValue += row.quantity * unitCost(row);
      byWarehouse.set(key, acc);
    }

    const data = [...byWarehouse.values()].sort((a, b) =>
      a.warehouseCode.localeCompare(b.warehouseCode),
    );
    const totals = data.reduce(
      (acc, w) => ({
        skuCount: acc.skuCount + w.skuCount,
        quantity: acc.quantity + w.quantity,
        reservedQuantity: acc.reservedQuantity + w.reservedQuantity,
        stockValue: acc.stockValue + w.stockValue,
      }),
      { skuCount: 0, quantity: 0, reservedQuantity: 0, stockValue: 0 },
    );

    return { data, totals };
  }

  /** Inventory rows whose available quantity has fallen to or below minStock. */
  async lowStock(query: QueryStockReportDto) {
    const rows = await this.prisma.inventory.findMany({
      where: query.warehouseId ? { warehouseId: query.warehouseId } : {},
      select: {
        quantity: true,
        reservedQuantity: true,
        averageCost: true,
        warehouse: { select: { id: true, name: true, code: true } },
        product: {
          select: {
            id: true,
            sku: true,
            nameUz: true,
            unit: true,
            minStock: true,
            recommendedStock: true,
            averageCost: true,
            purchasePrice: true,
          },
        },
      },
    });

    const flagged = rows
      .map((row) => {
        const available = row.quantity - row.reservedQuantity;
        return {
          productId: row.product.id,
          sku: row.product.sku,
          name: row.product.nameUz,
          unit: row.product.unit,
          warehouseId: row.warehouse.id,
          warehouseCode: row.warehouse.code,
          warehouseName: row.warehouse.name,
          quantity: row.quantity,
          reservedQuantity: row.reservedQuantity,
          availableQuantity: available,
          minStock: row.product.minStock,
          recommendedStock: row.product.recommendedStock,
          shortBy: Math.max(0, row.product.recommendedStock - available),
          status: deriveStockStatus(available, row.product.minStock),
          unitCost: unitCost(row),
          stockValue: row.quantity * unitCost(row),
        };
      })
      .filter((row) => row.availableQuantity <= row.minStock)
      .sort((a, b) => a.availableQuantity - b.availableQuantity);

    return {
      data: flagged,
      meta: paginationMeta(1, flagged.length || 1, flagged.length),
    };
  }

  /** Global stock ledger, newest first, paginated. */
  async movements(query: QueryMovementsReportDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.StockMovementWhereInput = {};
    if (query.type) where.type = query.type;
    if (query.warehouseId || query.productId) {
      where.inventory = {
        ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
        ...(query.productId ? { productId: query.productId } : {}),
      };
    }
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
      };
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.stockMovement.findMany({
        where,
        include: {
          inventory: {
            select: {
              warehouseId: true,
              warehouse: { select: { id: true, name: true, code: true } },
              product: { select: { id: true, sku: true, nameUz: true } },
            },
          },
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    return {
      data: rows.map((row) => ({
        id: row.id,
        type: row.type,
        quantity: row.quantity,
        balanceAfter: row.balanceAfter,
        unitCost: num(row.unitCost),
        reason: row.reason,
        referenceType: row.referenceType,
        referenceId: row.referenceId,
        productId: row.inventory.product.id,
        productSku: row.inventory.product.sku,
        productName: row.inventory.product.nameUz,
        warehouseId: row.warehouseId ?? row.inventory.warehouseId,
        warehouseCode: row.inventory.warehouse.code,
        warehouseName: row.inventory.warehouse.name,
        createdBy: row.createdBy,
        createdAt: row.createdAt,
      })),
      meta: paginationMeta(page, limit, total),
    };
  }
}
