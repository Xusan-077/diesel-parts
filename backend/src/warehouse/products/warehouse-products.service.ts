import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductsService } from '../../products/products.service';
import { Prisma } from '../../../generated/prisma/client';
import { paginationMeta } from '../../common/dto/pagination.dto';
import { deriveStockStatus, StockStatus } from '../../products/stock-status';
import {
  CreateWarehouseProductDto,
  UpdateWarehouseProductDto,
} from './dto/create-warehouse-product.dto';
import { QueryWarehouseProductsDto } from './dto/query-warehouse-products.dto';
import { QueryProductMovementsDto } from './dto/query-product-movements.dto';

const LIST_INCLUDE = {
  category: {
    select: { id: true, nameUz: true, nameRu: true, nameEn: true },
  },
  brand: { select: { id: true, name: true } },
} as const;

type InventoryRow = {
  warehouseId: string;
  quantity: number;
  reservedQuantity: number;
  averageCost: Prisma.Decimal | null;
};

function decToNumber(value: Prisma.Decimal | null): number | null {
  return value === null ? null : Number(value);
}

@Injectable()
export class WarehouseProductsService {
  constructor(
    private readonly prisma: PrismaService,
    /** Reused verbatim for writes — one product write contract, one audit path. */
    private readonly products: ProductsService,
  ) {}

  async list(query: QueryWarehouseProductsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.ProductWhereInput = {};
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.brandId) where.brandId = query.brandId;
    if (query.q) {
      const q = query.q;
      where.OR = [
        { nameUz: { contains: q, mode: 'insensitive' } },
        { nameRu: { contains: q, mode: 'insensitive' } },
        { nameEn: { contains: q, mode: 'insensitive' } },
        { sku: { contains: q, mode: 'insensitive' } },
        { barcode: { contains: q, mode: 'insensitive' } },
        // Array `has` takes no mode; OEM numbers are stored upper-cased.
        { oemNumbers: { has: q.toUpperCase() } },
      ];
    }

    const rows = await this.prisma.product.findMany({
      where,
      include: {
        ...LIST_INCLUDE,
        inventories: {
          where: query.warehouseId
            ? { warehouseId: query.warehouseId }
            : undefined,
          select: {
            warehouseId: true,
            quantity: true,
            reservedQuantity: true,
            averageCost: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    let mapped = rows.map((row) => this.toWarehouseView(row, row.inventories));
    if (query.status) {
      mapped = mapped.filter((row) => row.stockStatus === query.status);
    }

    const total = mapped.length;
    const data = mapped.slice((page - 1) * limit, (page - 1) * limit + limit);
    return {
      data,
      meta: paginationMeta(page, limit, total),
      scope: query.warehouseId ? 'warehouse' : 'all',
    };
  }

  async findOne(id: string, warehouseId?: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        ...LIST_INCLUDE,
        inventories: {
          select: {
            warehouseId: true,
            quantity: true,
            reservedQuantity: true,
            averageCost: true,
            warehouse: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });
    if (!product) throw new NotFoundException('Mahsulot topilmadi');

    const scoped = warehouseId
      ? product.inventories.filter((inv) => inv.warehouseId === warehouseId)
      : product.inventories;

    const view = this.toWarehouseView(product, scoped);

    return {
      ...view,
      byWarehouse: product.inventories.map((inv) => {
        const available = inv.quantity - inv.reservedQuantity;
        return {
          warehouseId: inv.warehouseId,
          warehouseCode: inv.warehouse.code,
          warehouseName: inv.warehouse.name,
          quantity: inv.quantity,
          reservedQuantity: inv.reservedQuantity,
          availableQuantity: available,
          averageCost: decToNumber(inv.averageCost),
        };
      }),
    };
  }

  create(dto: CreateWarehouseProductDto, actorId: string) {
    return this.products.create(dto, actorId);
  }

  update(id: string, dto: UpdateWarehouseProductDto, actorId: string) {
    return this.products.update(id, dto, actorId);
  }

  /** One product's stock ledger, newest first, each row carrying its balanceAfter. */
  async movements(id: string, query: QueryProductMovementsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const exists = await this.prisma.product.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Mahsulot topilmadi');

    const where: Prisma.StockMovementWhereInput = {
      inventory: {
        productId: id,
        ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      },
    };
    if (query.type) where.type = query.type;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.stockMovement.findMany({
        where,
        include: {
          inventory: {
            select: {
              warehouseId: true,
              warehouse: { select: { id: true, name: true, code: true } },
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
        unitCost: decToNumber(row.unitCost),
        reason: row.reason,
        referenceType: row.referenceType,
        referenceId: row.referenceId,
        warehouseId: row.warehouseId ?? row.inventory.warehouseId,
        warehouseCode: row.inventory.warehouse.code,
        warehouseName: row.inventory.warehouse.name,
        createdBy: row.createdBy,
        createdAt: row.createdAt,
      })),
      meta: paginationMeta(page, limit, total),
    };
  }

  private toWarehouseView(
    product: {
      minStock: number;
      purchasePrice: Prisma.Decimal | null;
      averageCost: Prisma.Decimal | null;
      lastPurchaseCost: Prisma.Decimal | null;
    } & Record<string, unknown>,
    inventories: InventoryRow[],
  ): Record<string, unknown> & {
    quantity: number;
    reservedQuantity: number;
    availableQuantity: number;
    stockStatus: StockStatus;
    stockValue: number;
  } {
    const quantity = inventories.reduce((sum, inv) => sum + inv.quantity, 0);
    const reservedQuantity = inventories.reduce(
      (sum, inv) => sum + inv.reservedQuantity,
      0,
    );
    const availableQuantity = quantity - reservedQuantity;
    const stockStatus = deriveStockStatus(availableQuantity, product.minStock);

    // Value the stock at the most specific cost available: the per-warehouse
    // average, then the product-wide average, then the last known purchase
    // price, then nothing.
    const fallbackCost =
      decToNumber(product.averageCost) ??
      decToNumber(product.purchasePrice) ??
      0;
    const stockValue = inventories.reduce((sum, inv) => {
      const unit = decToNumber(inv.averageCost) ?? fallbackCost;
      return sum + inv.quantity * unit;
    }, 0);

    const rest: Record<string, unknown> = { ...product };
    delete rest.inventories;
    return {
      ...rest,
      averageCost: decToNumber(product.averageCost),
      lastPurchaseCost: decToNumber(product.lastPurchaseCost),
      purchasePrice: decToNumber(product.purchasePrice),
      quantity,
      reservedQuantity,
      availableQuantity,
      stockStatus,
      stockValue,
    };
  }
}
