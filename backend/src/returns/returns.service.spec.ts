import { BadRequestException, ConflictException } from '@nestjs/common';
import { ReturnsService } from './returns.service';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { AuditService } from '../audit/audit.service';
import {
  OrderStatus,
  Prisma,
  ReturnCondition,
  ReturnReason,
  ReturnStatus,
  Role,
} from '../../generated/prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';

const seller: AuthenticatedUser = {
  id: 'seller-1',
  phone: '+998901234567',
  role: Role.SELLER,
  sellerId: 'seller-profile-1',
};

function orderFixture(
  overrides: Partial<{
    status: OrderStatus;
    warehouseId: string | null;
    items: {
      productId: string;
      qty: number;
      unitPrice: number;
      productName: string;
    }[];
    returns: { items: { productId: string; qty: number }[] }[];
  }> = {},
) {
  return {
    id: 'order-1',
    sellerId: 'seller-1',
    status: overrides.status ?? OrderStatus.COMPLETED,
    warehouseId: 'warehouseId' in overrides ? overrides.warehouseId! : 'w1',
    items: (
      overrides.items ?? [
        { productId: 'p1', qty: 2, unitPrice: 100, productName: 'Filter' },
      ]
    ).map((i) => ({ ...i, unitPrice: new Prisma.Decimal(i.unitPrice) })),
    returns: overrides.returns ?? [],
    payments: [{ method: 'CARD', status: 'COMPLETED' }],
  };
}

function makeAudit() {
  return {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as AuditService;
}

function makeInventory() {
  const restockForReturn = jest.fn().mockResolvedValue(undefined);
  const inventory = { restockForReturn } as unknown as InventoryService;
  return { inventory, restockForReturn };
}

function makePrisma(order: ReturnType<typeof orderFixture> | null) {
  const tx = {
    returnSequence: {
      upsert: jest.fn().mockResolvedValue({ lastNumber: 1 }),
    },
    return: {
      create: jest.fn().mockResolvedValue({ id: 'ret-1', items: [] }),
    },
    order: {
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const prisma = {
    order: {
      findUnique: jest.fn().mockResolvedValue(order),
    },
    $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  } as unknown as PrismaService;
  return { prisma, tx };
}

describe('ReturnsService.create', () => {
  it('persists an adjusted refund and resolves the original payment method', async () => {
    const { prisma, tx } = makePrisma(orderFixture());
    const service = new ReturnsService(
      prisma,
      makeInventory().inventory,
      makeAudit(),
    );
    await service.create(seller, {
      orderId: 'order-1',
      refundMethod: 'ORIGINAL',
      refundAmount: 80,
      items: [{ productId: 'p1', qty: 1, reason: 'OTHER', condition: 'GOOD' }],
    });
    const calls = tx.return.create.mock.calls as [
      { data: { refundMethod: string; refundAmount: Prisma.Decimal } },
    ][];
    expect(calls[0][0].data.refundMethod).toBe('CARD');
    expect(Number(calls[0][0].data.refundAmount)).toBe(80);
  });

  it('rejects a refund amount above selected items total', async () => {
    const { prisma, tx } = makePrisma(orderFixture());
    const service = new ReturnsService(
      prisma,
      makeInventory().inventory,
      makeAudit(),
    );
    await expect(
      service.create(seller, {
        orderId: 'order-1',
        refundMethod: 'PAYME',
        refundAmount: 101,
        items: [
          { productId: 'p1', qty: 1, reason: 'OTHER', condition: 'GOOD' },
        ],
      }),
    ).rejects.toMatchObject({ response: { error: 'refund_exceeds_total' } });
    expect(tx.return.create).not.toHaveBeenCalled();
  });

  it('rejects duplicated product lines that could bypass the quantity limit', async () => {
    const { prisma } = makePrisma(orderFixture());
    const service = new ReturnsService(
      prisma,
      makeInventory().inventory,
      makeAudit(),
    );
    const line = {
      productId: 'p1',
      qty: 2,
      reason: ReturnReason.OTHER,
      condition: ReturnCondition.GOOD,
    };
    await expect(
      service.create(seller, {
        orderId: 'order-1',
        refundMethod: 'CASH',
        items: [line, line],
      }),
    ).rejects.toMatchObject({ response: { error: 'duplicate_return_item' } });
  });

  it('rejects a return against an order that was never completed', async () => {
    const { prisma } = makePrisma(
      orderFixture({ status: OrderStatus.PENDING }),
    );
    const service = new ReturnsService(
      prisma,
      makeInventory().inventory,
      makeAudit(),
    );

    await expect(
      service.create(seller, {
        orderId: 'order-1',
        refundMethod: 'CASH',
        items: [
          {
            productId: 'p1',
            qty: 1,
            reason: ReturnReason.CHANGED_MIND,
            condition: ReturnCondition.GOOD,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects returning more than was purchased, net of earlier returns', async () => {
    const { prisma } = makePrisma(
      orderFixture({
        returns: [{ items: [{ productId: 'p1', qty: 1 }] }],
      }),
    );
    const service = new ReturnsService(
      prisma,
      makeInventory().inventory,
      makeAudit(),
    );

    await expect(
      service.create(seller, {
        orderId: 'order-1',
        refundMethod: 'CASH',
        // Original qty was 2, 1 already returned — only 1 remains.
        items: [
          {
            productId: 'p1',
            qty: 2,
            reason: ReturnReason.DEFECTIVE,
            condition: ReturnCondition.DAMAGED,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('restocks only GOOD-condition lines, and marks the order fully REFUNDED when every unit comes back', async () => {
    const { inventory, restockForReturn } = makeInventory();
    const { prisma, tx } = makePrisma(
      orderFixture({
        items: [
          { productId: 'p1', qty: 1, unitPrice: 100, productName: 'Filter' },
          { productId: 'p2', qty: 1, unitPrice: 50, productName: 'Belt' },
        ],
      }),
    );
    const service = new ReturnsService(prisma, inventory, makeAudit());

    await service.create(seller, {
      orderId: 'order-1',
      refundMethod: 'CASH',
      items: [
        {
          productId: 'p1',
          qty: 1,
          reason: ReturnReason.CHANGED_MIND,
          condition: ReturnCondition.GOOD,
        },
        {
          productId: 'p2',
          qty: 1,
          reason: ReturnReason.DEFECTIVE,
          condition: ReturnCondition.DEFECTIVE,
        },
      ],
    });

    expect(restockForReturn).toHaveBeenCalledWith(
      expect.anything(),
      'w1',
      [{ productId: 'p1', quantity: 1 }],
      seller.id,
      'ret-1',
    );
    expect(tx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: OrderStatus.REFUNDED } }),
    );
  });

  it('marks the order PARTIALLY_REFUNDED when only some lines are returned', async () => {
    const { prisma, tx } = makePrisma(
      orderFixture({
        items: [
          { productId: 'p1', qty: 2, unitPrice: 100, productName: 'Filter' },
          { productId: 'p2', qty: 1, unitPrice: 50, productName: 'Belt' },
        ],
      }),
    );
    const service = new ReturnsService(
      prisma,
      makeInventory().inventory,
      makeAudit(),
    );

    await service.create(seller, {
      orderId: 'order-1',
      refundMethod: 'CASH',
      items: [
        {
          productId: 'p1',
          qty: 1,
          reason: ReturnReason.CHANGED_MIND,
          condition: ReturnCondition.GOOD,
        },
      ],
    });

    expect(tx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: OrderStatus.PARTIALLY_REFUNDED },
      }),
    );
  });

  it('refuses a return when the order has no warehouse assigned', async () => {
    const { prisma } = makePrisma(orderFixture({ warehouseId: null }));
    const service = new ReturnsService(
      prisma,
      makeInventory().inventory,
      makeAudit(),
    );

    await expect(
      service.create(seller, {
        orderId: 'order-1',
        refundMethod: 'CASH',
        items: [
          {
            productId: 'p1',
            qty: 1,
            reason: ReturnReason.CHANGED_MIND,
            condition: ReturnCondition.GOOD,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('ReturnsService.findAll', () => {
  function makeListPrisma() {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const prisma = {
      return: { findMany, count },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    } as unknown as PrismaService;
    return { prisma, findMany };
  }

  it('scopes a seller to their own returns and applies the free-text search across return/order/customer', async () => {
    const { prisma, findMany } = makeListPrisma();
    const service = new ReturnsService(
      prisma,
      makeInventory().inventory,
      makeAudit(),
    );

    await service.findAll(seller, { search: 'RET-1' });

    const calls = findMany.mock.calls as [{ where: Prisma.ReturnWhereInput }][];
    const where = calls[0][0].where;
    expect(where.sellerId).toBe(seller.id);
    expect(where.OR).toEqual([
      { returnNumber: { contains: 'RET-1', mode: 'insensitive' } },
      { order: { orderNumber: { contains: 'RET-1', mode: 'insensitive' } } },
      {
        order: {
          customer: { name: { contains: 'RET-1', mode: 'insensitive' } },
        },
      },
    ]);
  });

  it('filters by status and a createdAt date range', async () => {
    const { prisma, findMany } = makeListPrisma();
    const service = new ReturnsService(
      prisma,
      makeInventory().inventory,
      makeAudit(),
    );

    await service.findAll(seller, {
      status: ReturnStatus.COMPLETED,
      dateFrom: '2026-09-01T00:00:00.000Z',
      dateTo: '2026-09-10T00:00:00.000Z',
    });

    const calls = findMany.mock.calls as [{ where: Prisma.ReturnWhereInput }][];
    const where = calls[0][0].where as {
      status: string;
      createdAt: { gte: Date; lte: Date };
    };
    expect(where.status).toBe('COMPLETED');
    expect(where.createdAt.gte).toEqual(new Date('2026-09-01T00:00:00.000Z'));
    expect(where.createdAt.lte).toEqual(new Date('2026-09-10T00:00:00.000Z'));
  });
});
