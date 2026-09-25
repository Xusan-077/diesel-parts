import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { AuditService } from '../audit/audit.service';
import { CreateReturnDto } from './dto/create-return.dto';
import { QueryReturnDto } from './dto/query-return.dto';
import { paginationMeta } from '../common/dto/pagination.dto';
import { assertOrderVisible } from '../common/order-access';
import {
  AuditAction,
  OrderStatus,
  Prisma,
  Role,
  ReturnCondition,
  ReturnRefundMethod,
} from '../../generated/prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';

const RETURN_INCLUDE = {
  order: {
    select: {
      id: true,
      orderNumber: true,
      sellerId: true,
      customerId: true,
      customer: { select: { id: true, name: true, phone: true } },
    },
  },
  seller: { select: { id: true, name: true } },
  items: {
    include: { product: { select: { id: true, sku: true, nameEn: true } } },
  },
} as const;

@Injectable()
export class ReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly audit: AuditService,
  ) {}

  async findAll(actor: AuthenticatedUser, query: QueryReturnDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.ReturnWhereInput = {};
    if (actor.role === Role.SELLER) where.sellerId = actor.id;
    if (query.orderId) where.orderId = query.orderId;
    if (query.status) where.status = query.status;
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
      };
    }
    if (query.search) {
      where.OR = [
        { returnNumber: { contains: query.search, mode: 'insensitive' } },
        {
          order: {
            orderNumber: { contains: query.search, mode: 'insensitive' },
          },
        },
        {
          order: {
            customer: { name: { contains: query.search, mode: 'insensitive' } },
          },
        },
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.return.findMany({
        where,
        include: RETURN_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.return.count({ where }),
    ]);

    return { data, meta: paginationMeta(page, limit, total) };
  }

  async findOne(actor: AuthenticatedUser, id: string) {
    const found = await this.prisma.return.findUnique({
      where: { id },
      include: RETURN_INCLUDE,
    });
    if (!found) throw new NotFoundException('Return not found');
    assertOrderVisible(actor, found.sellerId);
    return found;
  }

  /**
   * Only a settled sale (COMPLETED, or already partly returned) can be
   * returned against. Requested quantities are checked against what the
   * order actually sold minus whatever earlier returns already took, so two
   * returns cannot together refund more than was ever purchased. Only
   * `GOOD`-condition lines go back on the shelf; the rest are recorded (the
   * customer is still refunded) but never touch stock.
   */
  async create(actor: AuthenticatedUser, dto: CreateReturnDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: {
        items: true,
        payments: true,
        returns: { include: { items: true } },
      },
    });
    if (!order) {
      throw new NotFoundException({
        error: 'order_not_found',
        message: 'Buyurtma topilmadi',
      });
    }
    assertOrderVisible(actor, order.sellerId);

    if (
      order.status !== OrderStatus.COMPLETED &&
      order.status !== OrderStatus.PARTIALLY_REFUNDED
    ) {
      throw new ConflictException({
        error: 'not_returnable',
        message: 'Faqat yakunlangan buyurtmani qaytarish mumkin',
      });
    }
    if (!order.warehouseId) {
      throw new BadRequestException(
        'Order has no warehouse assigned; a return cannot be processed',
      );
    }
    const warehouseId = order.warehouseId;
    let refundMethod: ReturnRefundMethod;
    if (dto.refundMethod === 'ORIGINAL') {
      const methods = [
        ...new Set(
          order.payments
            .filter((p) => p.status === 'COMPLETED')
            .map((p) => p.method),
        ),
      ];
      if (methods.length !== 1 || methods[0] === 'SELLER_AGREEMENT') {
        throw new BadRequestException({
          error: 'original_payment_ambiguous',
          message: 'Qaytarish usulini tanlang',
        });
      }
      refundMethod = methods[0];
    } else {
      refundMethod = dto.refundMethod;
    }

    const originalByProduct = new Map<
      string,
      { qty: number; unitPrice: Prisma.Decimal; name: string }
    >();
    for (const item of order.items) {
      const existing = originalByProduct.get(item.productId);
      originalByProduct.set(item.productId, {
        qty: (existing?.qty ?? 0) + item.qty,
        unitPrice: existing?.unitPrice ?? item.unitPrice,
        name: item.productName,
      });
    }

    const alreadyReturnedByProduct = new Map<string, number>();
    for (const previous of order.returns) {
      for (const line of previous.items) {
        alreadyReturnedByProduct.set(
          line.productId,
          (alreadyReturnedByProduct.get(line.productId) ?? 0) + line.qty,
        );
      }
    }

    const linesToCreate: {
      productId: string;
      qty: number;
      unitPrice: Prisma.Decimal;
      lineTotal: Prisma.Decimal;
      reason: (typeof dto.items)[number]['reason'];
      condition: ReturnCondition;
    }[] = [];
    let refundAmount = new Prisma.Decimal(0);
    const requestedProducts = new Set<string>();

    for (const requested of dto.items) {
      if (requestedProducts.has(requested.productId)) {
        throw new BadRequestException({
          error: 'duplicate_return_item',
          message: 'Mahsulot takrorlangan',
        });
      }
      requestedProducts.add(requested.productId);
      const original = originalByProduct.get(requested.productId);
      if (!original) {
        throw new BadRequestException({
          error: 'not_in_order',
          productId: requested.productId,
          message: `Product ${requested.productId} was not part of this order`,
        });
      }
      const alreadyReturned =
        alreadyReturnedByProduct.get(requested.productId) ?? 0;
      const remaining = original.qty - alreadyReturned;
      if (requested.qty > remaining) {
        throw new ConflictException({
          error: 'exceeds_purchased_qty',
          productId: requested.productId,
          remaining,
          message: `${original.name} — sotib olingan ${original.qty} donadan ${alreadyReturned} donasi allaqachon qaytarilgan, qolgani ${remaining} dona`,
        });
      }

      const lineTotal = original.unitPrice.mul(requested.qty);
      refundAmount = refundAmount.add(lineTotal);
      linesToCreate.push({
        productId: requested.productId,
        qty: requested.qty,
        unitPrice: original.unitPrice,
        lineTotal,
        reason: requested.reason,
        condition: requested.condition,
      });
    }

    if (dto.refundAmount !== undefined) {
      const requestedAmount = new Prisma.Decimal(dto.refundAmount);
      if (requestedAmount.gt(refundAmount)) {
        throw new BadRequestException({
          error: 'refund_exceeds_total',
          message: 'Qaytarish summasi mahsulotlar summasidan oshmasin',
        });
      }
      refundAmount = requestedAmount;
    }

    // Across every product line on the order, has every purchased unit now
    // been returned (this batch included)?
    const isFullyReturned = [...originalByProduct.entries()].every(
      ([productId, original]) => {
        const returnedSoFar = alreadyReturnedByProduct.get(productId) ?? 0;
        const returnedInThisBatch =
          linesToCreate.find((l) => l.productId === productId)?.qty ?? 0;
        return returnedSoFar + returnedInThisBatch >= original.qty;
      },
    );
    const nextOrderStatus = isFullyReturned
      ? OrderStatus.REFUNDED
      : OrderStatus.PARTIALLY_REFUNDED;

    const restockable = linesToCreate.filter(
      (l) => l.condition === ReturnCondition.GOOD,
    );

    const created = await this.prisma.$transaction(async (tx) => {
      const returnNumber = await this.reserveReturnNumber(tx);

      const record = await tx.return.create({
        data: {
          returnNumber,
          orderId: order.id,
          sellerId: actor.id,
          refundMethod,
          refundAmount,
          items: { create: linesToCreate },
        },
        include: RETURN_INCLUDE,
      });

      if (restockable.length > 0) {
        await this.inventory.restockForReturn(
          tx,
          warehouseId,
          restockable.map((l) => ({ productId: l.productId, quantity: l.qty })),
          actor.id,
          record.id,
        );
      }

      await tx.order.update({
        where: { id: order.id },
        data: { status: nextOrderStatus },
      });

      return record;
    });

    await this.audit.record({
      userId: actor.id,
      action: AuditAction.CREATE,
      entityType: 'Return',
      entityId: created.id,
      after: {
        orderId: order.id,
        refundAmount: Number(refundAmount),
        refundMethod,
        itemCount: linesToCreate.length,
        newOrderStatus: nextOrderStatus,
      },
    });

    return created;
  }

  private async reserveReturnNumber(
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const sequence = await tx.returnSequence.upsert({
      where: { id: 1 },
      create: { id: 1, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    });
    return `RET-${sequence.lastNumber}`;
  }
}
