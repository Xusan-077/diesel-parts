import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import {
  AuditAction,
  GoodsReceiptStatus,
  Prisma,
  StockMovementType,
} from '../../../generated/prisma/client';
import { paginationMeta } from '../../common/dto/pagination.dto';
import {
  CreateGoodsReceiptDto,
  GoodsReceiptItemInputDto,
} from './dto/create-goods-receipt.dto';
import { UpdateGoodsReceiptDto } from './dto/update-goods-receipt.dto';
import { QueryGoodsReceiptsDto } from './dto/query-goods-receipts.dto';

type Tx = Prisma.TransactionClient;

const RECEIPT_INCLUDE = {
  warehouse: { select: { id: true, name: true, code: true } },
  createdBy: { select: { id: true, name: true } },
  approvedBy: { select: { id: true, name: true } },
  items: {
    include: {
      product: { select: { id: true, sku: true, nameUz: true, unit: true } },
    },
  },
} as const;

type PreparedItem = {
  productId: string;
  quantity: number;
  unitCost: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
};

function d(value: Prisma.Decimal | number | string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function auditSnapshot(receipt: {
  receiptNumber: string;
  warehouseId: string;
  status: GoodsReceiptStatus;
  supplierName: string | null;
  subtotal: Prisma.Decimal;
  discount: Prisma.Decimal;
  tax: Prisma.Decimal;
  total: Prisma.Decimal;
  items?: { productId: string; quantity: number; unitCost: Prisma.Decimal }[];
}) {
  return {
    receiptNumber: receipt.receiptNumber,
    warehouseId: receipt.warehouseId,
    status: receipt.status,
    supplierName: receipt.supplierName,
    subtotal: Number(receipt.subtotal),
    discount: Number(receipt.discount),
    tax: Number(receipt.tax),
    total: Number(receipt.total),
    itemCount: receipt.items?.length,
  };
}

@Injectable()
export class GoodsReceiptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: QueryGoodsReceiptsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.GoodsReceiptWhereInput = {};
    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.status) where.status = query.status;
    if (query.q) {
      where.OR = [
        { receiptNumber: { contains: query.q, mode: 'insensitive' } },
        { supplierName: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.goodsReceipt.findMany({
        where,
        include: RECEIPT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.goodsReceipt.count({ where }),
    ]);

    return { data: rows, meta: paginationMeta(page, limit, total) };
  }

  async findOne(id: string) {
    const receipt = await this.prisma.goodsReceipt.findUnique({
      where: { id },
      include: RECEIPT_INCLUDE,
    });
    if (!receipt) throw new NotFoundException('Qabul topilmadi');
    return receipt;
  }

  async create(dto: CreateGoodsReceiptDto, actorId: string, ip?: string) {
    const receipt = await this.prisma.$transaction(async (tx) => {
      await this.assertWarehouse(tx, dto.warehouseId);
      const items = await this.prepareItems(tx, dto.items);
      const totals = this.totals(items, dto.discount ?? 0, dto.tax ?? 0);
      const receiptNumber = await this.nextReceiptNumber(tx);

      return tx.goodsReceipt.create({
        data: {
          receiptNumber,
          warehouseId: dto.warehouseId,
          supplierName: dto.supplierName,
          note: dto.note,
          status: GoodsReceiptStatus.DRAFT,
          discount: d(dto.discount ?? 0),
          tax: d(dto.tax ?? 0),
          subtotal: totals.subtotal,
          total: totals.total,
          createdById: actorId,
          items: { create: items },
        },
        include: RECEIPT_INCLUDE,
      });
    });

    await this.audit.record({
      userId: actorId,
      action: AuditAction.CREATE,
      entityType: 'GoodsReceipt',
      entityId: receipt.id,
      after: auditSnapshot(receipt),
      ipAddress: ip,
    });
    return receipt;
  }

  async update(
    id: string,
    dto: UpdateGoodsReceiptDto,
    actorId: string,
    ip?: string,
  ) {
    const before = await this.findOne(id);
    if (before.status !== GoodsReceiptStatus.DRAFT) {
      throw new BadRequestException(
        'Faqat DRAFT holatidagi qabulni tahrirlash mumkin',
      );
    }

    const after = await this.prisma.$transaction(async (tx) => {
      if (dto.warehouseId) await this.assertWarehouse(tx, dto.warehouseId);

      let items: PreparedItem[] | null = null;
      if (dto.items) {
        items = await this.prepareItems(tx, dto.items);
        await tx.goodsReceiptItem.deleteMany({ where: { goodsReceiptId: id } });
        await tx.goodsReceiptItem.createMany({
          data: items.map((item) => ({ ...item, goodsReceiptId: id })),
        });
      }

      const effectiveItems: { lineTotal: Prisma.Decimal }[] =
        items ?? before.items;
      const discount = dto.discount ?? Number(before.discount);
      const tax = dto.tax ?? Number(before.tax);
      const totals = this.totals(effectiveItems, discount, tax);

      return tx.goodsReceipt.update({
        where: { id },
        data: {
          warehouseId: dto.warehouseId,
          supplierName: dto.supplierName,
          note: dto.note,
          discount: d(discount),
          tax: d(tax),
          subtotal: totals.subtotal,
          total: totals.total,
        },
        include: RECEIPT_INCLUDE,
      });
    });

    await this.audit.record({
      userId: actorId,
      action: AuditAction.UPDATE,
      entityType: 'GoodsReceipt',
      entityId: id,
      before: auditSnapshot(before),
      after: auditSnapshot(after),
      ipAddress: ip,
    });
    return after;
  }

  async approve(id: string, actorId: string, ip?: string) {
    const approved = await this.prisma.$transaction(async (tx) => {
      const receipt = await tx.goodsReceipt.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!receipt) throw new NotFoundException('Qabul topilmadi');
      if (receipt.status !== GoodsReceiptStatus.DRAFT) {
        throw new BadRequestException(
          'Faqat DRAFT holatidagi qabulni tasdiqlash mumkin',
        );
      }

      for (const item of receipt.items) {
        await this.applyItemToStock(tx, receipt, item, actorId);
      }
      await this.rollUpProductCosts(tx, receipt.items);

      return tx.goodsReceipt.update({
        where: { id },
        data: {
          status: GoodsReceiptStatus.APPROVED,
          approvedById: actorId,
          approvedAt: new Date(),
        },
        include: RECEIPT_INCLUDE,
      });
    });

    await this.audit.record({
      userId: actorId,
      action: AuditAction.APPROVE,
      entityType: 'GoodsReceipt',
      entityId: id,
      after: auditSnapshot(approved),
      ipAddress: ip,
    });
    return approved;
  }

  async cancel(id: string, actorId: string, ip?: string) {
    const before = await this.findOne(id);
    if (before.status !== GoodsReceiptStatus.DRAFT) {
      throw new BadRequestException(
        'Faqat DRAFT holatidagi qabulni bekor qilish mumkin',
      );
    }

    const after = await this.prisma.goodsReceipt.update({
      where: { id },
      data: { status: GoodsReceiptStatus.CANCELLED },
      include: RECEIPT_INCLUDE,
    });

    await this.audit.record({
      userId: actorId,
      action: AuditAction.REJECT,
      entityType: 'GoodsReceipt',
      entityId: id,
      before: auditSnapshot(before),
      after: auditSnapshot(after),
      ipAddress: ip,
    });
    return after;
  }

  // --- internals ---------------------------------------------------------

  private async assertWarehouse(tx: Tx, warehouseId: string) {
    const warehouse = await tx.warehouse.findUnique({
      where: { id: warehouseId },
      select: { id: true },
    });
    if (!warehouse) throw new NotFoundException('Ombor topilmadi');
  }

  private async prepareItems(
    tx: Tx,
    items: GoodsReceiptItemInputDto[],
  ): Promise<PreparedItem[]> {
    const ids = [...new Set(items.map((item) => item.productId))];
    const found = await tx.product.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    if (found.length !== ids.length) {
      throw new BadRequestException(
        "Ba'zi mahsulotlar topilmadi — qatorlarni tekshiring",
      );
    }

    return items.map((item) => {
      const unitCost = d(item.unitCost);
      return {
        productId: item.productId,
        quantity: item.quantity,
        unitCost,
        lineTotal: unitCost.mul(item.quantity),
      };
    });
  }

  private totals(
    items: { lineTotal: Prisma.Decimal }[],
    discount: number,
    tax: number,
  ) {
    const subtotal = items.reduce((acc, item) => acc.add(item.lineTotal), d(0));
    const total = subtotal.sub(d(discount)).add(d(tax));
    return { subtotal, total };
  }

  /** Atomic-per-attempt receipt number `GR-<year>-<0001>`. */
  private async nextReceiptNumber(tx: Tx): Promise<string> {
    const sequence = await tx.goodsReceiptSequence.upsert({
      where: { id: 1 },
      create: { id: 1, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    });
    const year = new Date().getFullYear();
    return `GR-${year}-${String(sequence.lastNumber).padStart(4, '0')}`;
  }

  private async applyItemToStock(
    tx: Tx,
    receipt: { id: string; warehouseId: string; receiptNumber: string },
    item: { productId: string; quantity: number; unitCost: Prisma.Decimal },
    actorId: string,
  ) {
    const existing = await tx.inventory.findUnique({
      where: {
        productId_warehouseId: {
          productId: item.productId,
          warehouseId: receipt.warehouseId,
        },
      },
    });

    const unitCost = Number(item.unitCost);
    const oldQty = existing?.quantity ?? 0;
    const newQty = oldQty + item.quantity;
    const priorAvg =
      existing?.averageCost != null ? Number(existing.averageCost) : unitCost;
    const newAvg =
      oldQty > 0
        ? (oldQty * priorAvg + item.quantity * unitCost) / newQty
        : unitCost;

    const inventory = existing
      ? await tx.inventory.update({
          where: { id: existing.id },
          data: { quantity: newQty, averageCost: d(newAvg.toFixed(2)) },
        })
      : await tx.inventory.create({
          data: {
            productId: item.productId,
            warehouseId: receipt.warehouseId,
            quantity: item.quantity,
            reservedQuantity: 0,
            averageCost: d(unitCost.toFixed(2)),
          },
        });

    await tx.stockMovement.create({
      data: {
        inventoryId: inventory.id,
        type: StockMovementType.PURCHASE,
        quantity: item.quantity,
        balanceAfter: inventory.quantity,
        reason: `Qabul ${receipt.receiptNumber}`,
        referenceType: 'GoodsReceipt',
        referenceId: receipt.id,
        unitCost: item.unitCost,
        warehouseId: receipt.warehouseId,
        createdById: actorId,
      },
    });
  }

  /** Global weighted-average roll-up + lastPurchaseCost for each touched product. */
  private async rollUpProductCosts(
    tx: Tx,
    items: { productId: string; unitCost: Prisma.Decimal }[],
  ) {
    const productIds = [...new Set(items.map((item) => item.productId))];
    for (const productId of productIds) {
      const rows = await tx.inventory.findMany({
        where: { productId },
        select: { quantity: true, averageCost: true },
      });
      const totalQty = rows.reduce((sum, row) => sum + row.quantity, 0);
      const weighted = rows.reduce(
        (sum, row) =>
          sum +
          row.quantity *
            (row.averageCost != null ? Number(row.averageCost) : 0),
        0,
      );
      // The last line for this product in the receipt is the "latest" cost.
      const lastLine = [...items]
        .reverse()
        .find((item) => item.productId === productId);

      await tx.product.update({
        where: { id: productId },
        data: {
          averageCost:
            totalQty > 0 ? d((weighted / totalQty).toFixed(2)) : undefined,
          lastPurchaseCost: lastLine?.unitCost,
        },
      });
    }
  }
}
