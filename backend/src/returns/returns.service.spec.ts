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
