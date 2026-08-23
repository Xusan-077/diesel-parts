import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, StockMovementType } from '../../generated/prisma/client';
import { QueryInventoryDto } from './dto/query-inventory.dto';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto';
import { paginationMeta } from '../common/dto/pagination.dto';
import { deriveStockStatus, StockStatus } from '../products/stock-status';

type Tx = Prisma.TransactionClient;

const INCLUDE = {
  product: { select: { id: true, sku: true, nameEn: true, minStock: true } },
  warehouse: { select: { id: true, name: true } },
} as const;

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryInventoryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Record<string, unknown> = {};
    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.productId) where.productId = query.productId;

    const rows = await this.prisma.inventory.findMany({
      where,
      include: INCLUDE,
      orderBy: { updatedAt: 'desc' },
    });
    let withStatus = rows.map((row) => this.withStatus(row));
    if (query.status) {
      withStatus = withStatus.filter((row) => row.status === query.status);
    }

    const total = withStatus.length;
    const data = withStatus.slice(
      (page - 1) * limit,
      (page - 1) * limit + limit,
    );
    return { data, meta: paginationMeta(page, limit, total) };
  }

  async lowStock(query: QueryInventoryDto) {
    const rows = await this.prisma.inventory.findMany({
      where: query.warehouseId ? { warehouseId: query.warehouseId } : {},
      include: INCLUDE,
      orderBy: { updatedAt: 'desc' },
    });
    const flagged = rows
      .map((row) => this.withStatus(row))
      .filter((row) => row.status !== StockStatus.IN_STOCK);
    return {
      data: flagged,
      meta: paginationMeta(1, flagged.length || 1, flagged.length),
    };
  }

  async movements(query: {
    page: number;
    limit: number;
    productId?: string;
    warehouseId?: string;
  }) {
    const where: Prisma.StockMovementWhereInput = {};
    if (query.productId || query.warehouseId) {
      where.inventory = {
        ...(query.productId ? { productId: query.productId } : {}),
        ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      };
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.stockMovement.findMany({
        where,
        include: {
          inventory: { include: INCLUDE },
          createdBy: { select: { id: true, phone: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    return { data, meta: paginationMeta(query.page, query.limit, total) };
  }

  /** Manual stock adjustment (IN receiving stock, OUT correcting a loss). Reserve/Release are driven by order status transitions instead. */
  async adjust(dto: AdjustInventoryDto, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const inventory = await this.getOrCreateInventoryRow(
        tx,
        dto.productId,
        dto.warehouseId,
      );

      if (
        dto.type === StockMovementType.OUT &&
        inventory.quantity < dto.quantity
      ) {
        throw new BadRequestException(
          'Cannot remove more stock than is on hand',
        );
      }
      if (
        dto.type === StockMovementType.RELEASE &&
        inventory.reservedQuantity < dto.quantity
      ) {
        throw new BadRequestException('Cannot release more than is reserved');
      }

      const delta = this.deltaFor(dto.type, dto.quantity);
      const updated = await tx.inventory.update({
        where: { id: inventory.id },
        data: {
          quantity: { increment: delta.quantity },
          reservedQuantity: { increment: delta.reserved },
        },
      });

      await tx.stockMovement.create({
        data: {
          inventoryId: inventory.id,
          type: dto.type,
          quantity: dto.quantity,
          reason: dto.reason,
          createdById: userId,
        },
      });

      return updated;
    });
  }

  /** Reserves stock for each order line inside the caller's transaction. Throws if any line is short on available stock. */
  async reserveForOrder(
    tx: Tx,
    warehouseId: string,
    items: { productId: string; quantity: number }[],
    userId: string,
  ) {
    for (const item of items) {
      const inventory = await this.getOrCreateInventoryRow(
        tx,
        item.productId,
        warehouseId,
      );
      const available = inventory.quantity - inventory.reservedQuantity;
      if (available < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for product ${item.productId}: available ${available}, requested ${item.quantity}`,
        );
      }

      await tx.inventory.update({
        where: { id: inventory.id },
        data: { reservedQuantity: { increment: item.quantity } },
      });
      await tx.stockMovement.create({
        data: {
          inventoryId: inventory.id,
          type: StockMovementType.RESERVE,
          quantity: item.quantity,
          reason: 'Order confirmed',
          createdById: userId,
        },
      });
    }
  }

  /** Releases a previously reserved order's stock inside the caller's transaction. */
  async releaseForOrder(
    tx: Tx,
    warehouseId: string,
    items: { productId: string; quantity: number }[],
    userId: string,
    reason: string,
  ) {
    for (const item of items) {
      const inventory = await tx.inventory.findUnique({
        where: {
          productId_warehouseId: { productId: item.productId, warehouseId },
        },
      });
      if (!inventory) continue;

      const releaseQty = Math.min(item.quantity, inventory.reservedQuantity);
      if (releaseQty <= 0) continue;

      await tx.inventory.update({
        where: { id: inventory.id },
        data: { reservedQuantity: { decrement: releaseQty } },
      });
      await tx.stockMovement.create({
        data: {
          inventoryId: inventory.id,
          type: StockMovementType.RELEASE,
          quantity: releaseQty,
          reason,
          createdById: userId,
        },
      });
    }
  }

  /** Consumes reserved stock permanently when an order completes (quantity and reservedQuantity both drop). */
  async fulfillForOrder(
    tx: Tx,
    warehouseId: string,
    items: { productId: string; quantity: number }[],
    userId: string,
  ) {
    for (const item of items) {
      const inventory = await tx.inventory.findUnique({
        where: {
          productId_warehouseId: { productId: item.productId, warehouseId },
        },
      });
      if (!inventory) continue;

      const qty = Math.min(item.quantity, inventory.quantity);
      const reservedQty = Math.min(item.quantity, inventory.reservedQuantity);

      await tx.inventory.update({
        where: { id: inventory.id },
        data: {
          quantity: { decrement: qty },
          reservedQuantity: { decrement: reservedQty },
        },
      });
      await tx.stockMovement.create({
        data: {
          inventoryId: inventory.id,
          type: StockMovementType.OUT,
          quantity: qty,
          reason: 'Order completed',
          createdById: userId,
        },
      });
    }
  }

  private async getOrCreateInventoryRow(
    tx: Tx,
    productId: string,
    warehouseId: string,
  ) {
    const existing = await tx.inventory.findUnique({
      where: { productId_warehouseId: { productId, warehouseId } },
    });
    if (existing) return existing;

    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');
    const warehouse = await tx.warehouse.findUnique({
      where: { id: warehouseId },
    });
    if (!warehouse) throw new NotFoundException('Warehouse not found');

    return tx.inventory.create({
      data: { productId, warehouseId, quantity: 0, reservedQuantity: 0 },
    });
  }

  private deltaFor(type: StockMovementType, quantity: number) {
    switch (type) {
      case StockMovementType.IN:
        return { quantity, reserved: 0 };
      case StockMovementType.OUT:
        return { quantity: -quantity, reserved: 0 };
      case StockMovementType.RESERVE:
        return { quantity: 0, reserved: quantity };
      case StockMovementType.RELEASE:
        return { quantity: 0, reserved: -quantity };
    }
  }

  private withStatus<
    T extends {
      quantity: number;
      reservedQuantity: number;
      product: { minStock: number };
    },
  >(row: T) {
    const availableQuantity = row.quantity - row.reservedQuantity;
    const status = deriveStockStatus(availableQuantity, row.product.minStock);
    return { ...row, availableQuantity, status };
  }
}
