import { ConflictException, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { AuditService } from '../audit/audit.service';
import {
  AuditAction,
  DiscountStatus,
  NotificationType,
  OrderStatus,
  Prisma,
  Role,
} from '../../generated/prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';

const seller: AuthenticatedUser = {
  id: 'seller-user-1',
  phone: '+998901234567',
  role: Role.SELLER,
  sellerId: 'seller-1',
};

function makeTx(
  overrides: {
    discountRequest?: Record<string, unknown>;
    order?: Record<string, unknown>;
    notification?: Record<string, unknown>;
  } = {},
) {
  return {
    discountRequest: {
      create: jest.fn().mockResolvedValue({ id: 'req-1' }),
      ...overrides.discountRequest,
    },
    order: {
      update: jest.fn().mockResolvedValue({}),
      ...overrides.order,
    },
    notification: {
      createMany: jest.fn().mockResolvedValue({}),
      ...overrides.notification,
    },
  };
}

function makePrisma(
  overrides: {
    order?: Record<string, unknown>;
    user?: Record<string, unknown>;
    discountRequest?: Record<string, unknown>;
    tx?: ReturnType<typeof makeTx>;
  } = {},
) {
  const tx = overrides.tx ?? makeTx();
  const $transaction = jest.fn(
    async (callback: (tx: ReturnType<typeof makeTx>) => Promise<unknown>) =>
      callback(tx),
  );

  const prisma = {
    order: {
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
      ...overrides.order,
    },
    user: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({ discountLimit: 10 }),
      findMany: jest.fn().mockResolvedValue([]),
      ...overrides.user,
    },
    discountRequest: {
      findFirst: jest.fn().mockResolvedValue(null),
      ...overrides.discountRequest,
    },
    $transaction,
  } as unknown as PrismaService;

  return { prisma, tx, $transaction };
}

function makeAudit() {
  const record = jest.fn().mockResolvedValue(undefined);
  const audit = { record } as unknown as AuditService;
  return { audit, record };
}

function makeInventory() {
  return {} as unknown as InventoryService;
}

describe('OrdersService.requestDiscount', () => {
  it('throws NotFoundException when the order does not exist', async () => {
    const { prisma } = makePrisma({
      order: { findUnique: jest.fn().mockResolvedValue(null) },
    });
    const { audit } = makeAudit();
    const service = new OrdersService(prisma, makeInventory(), audit);

    await expect(
      service.requestDiscount(seller, 'order-1', { percent: 5 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('within the seller limit: approves immediately, updates the order in one write, and audits UPDATE', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: 'order-1',
      sellerId: 'seller-1',
      subtotal: new Prisma.Decimal(1000),
      discountRequestedPercent: new Prisma.Decimal(0),
      discountApprovedPercent: new Prisma.Decimal(0),
      total: new Prisma.Decimal(1000),
    });
    const orderUpdate = jest.fn().mockResolvedValue({
      id: 'order-1',
      discountApprovedPercent: new Prisma.Decimal(5),
      total: new Prisma.Decimal(950),
    });
    const { prisma } = makePrisma({
      order: { findUnique, update: orderUpdate },
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ discountLimit: 10 }),
      },
    });
    const { audit, record } = makeAudit();
    const service = new OrdersService(prisma, makeInventory(), audit);

    const result = await service.requestDiscount(seller, 'order-1', {
      percent: 5,
    });

    expect(orderUpdate).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: {
        discountRequestedPercent: new Prisma.Decimal(5),
        discountApprovedPercent: new Prisma.Decimal(5),
        total: new Prisma.Decimal(950),
      },
    });
    expect(record).toHaveBeenCalledWith({
      userId: 'seller-user-1',
      action: AuditAction.UPDATE,
      entityType: 'Order',
      entityId: 'order-1',
      before: { discountApprovedPercent: 0, total: 1000 },
      after: { discountApprovedPercent: 5, total: 950 },
    });
    expect(result).toEqual({
      id: 'order-1',
      discountApprovedPercent: new Prisma.Decimal(5),
      total: new Prisma.Decimal(950),
    });
  });

  it('over the seller limit: creates a PENDING DiscountRequest, notifies every active director, leaves the approved discount untouched, and audits CREATE', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: 'order-1',
      sellerId: 'seller-1',
      subtotal: new Prisma.Decimal(1000),
      discountRequestedPercent: new Prisma.Decimal(0),
      discountApprovedPercent: new Prisma.Decimal(0),
      total: new Prisma.Decimal(1000),
    });
    const directorFindMany = jest
      .fn()
      .mockResolvedValue([{ id: 'director-1' }, { id: 'director-2' }]);
    const tx = makeTx();
    const { prisma } = makePrisma({
      order: { findUnique },
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ discountLimit: 10 }),
        findMany: directorFindMany,
      },
      tx,
    });
    const { audit, record } = makeAudit();
    const service = new OrdersService(prisma, makeInventory(), audit);

    const result = await service.requestDiscount(seller, 'order-1', {
      percent: 20,
      reason: 'Loyal customer',
    });

    expect(directorFindMany).toHaveBeenCalledWith({
      where: { role: Role.DIRECTOR, isActive: true },
      select: { id: true },
    });
    expect(tx.discountRequest.create).toHaveBeenCalledWith({
      data: {
        orderId: 'order-1',
        sellerId: 'seller-user-1',
        requestedPercent: new Prisma.Decimal(20),
        reason: 'Loyal customer',
      },
    });
    // The seller's ceiling was exceeded, so the order's charged total must
    // not move: only what was requested is recorded, not what was approved.
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { discountRequestedPercent: new Prisma.Decimal(20) },
    });
    expect(tx.notification.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: 'director-1',
          type: NotificationType.DISCOUNT_REQUESTED,
          entityId: 'order-1',
          message: "20% chegirma so'raldi.",
        },
        {
          userId: 'director-2',
          type: NotificationType.DISCOUNT_REQUESTED,
          entityId: 'order-1',
          message: "20% chegirma so'raldi.",
        },
      ],
    });
    expect(record).toHaveBeenCalledWith({
      userId: 'seller-user-1',
      action: AuditAction.CREATE,
      entityType: 'DiscountRequest',
      entityId: 'req-1',
      after: {
        orderId: 'order-1',
        requestedPercent: 20,
        status: DiscountStatus.PENDING,
        sellerLimit: 10,
      },
    });
    expect(result).toEqual({ id: 'req-1' });
  });

  it('refuses a second concurrent pending request on the same order', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: 'order-1',
      sellerId: 'seller-1',
      subtotal: new Prisma.Decimal(1000),
      discountRequestedPercent: new Prisma.Decimal(15),
      discountApprovedPercent: new Prisma.Decimal(0),
      total: new Prisma.Decimal(1000),
    });
    const { prisma, $transaction } = makePrisma({
      order: { findUnique },
      discountRequest: {
        findFirst: jest.fn().mockResolvedValue({ id: 'existing-req' }),
      },
    });
    const { audit, record } = makeAudit();
    const service = new OrdersService(prisma, makeInventory(), audit);

    await expect(
      service.requestDiscount(seller, 'order-1', { percent: 20 }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect($transaction).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it('refuses a discount request on a COMPLETED order, with no side effects', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: 'order-1',
      sellerId: 'seller-1',
      status: OrderStatus.COMPLETED,
      subtotal: new Prisma.Decimal(1000),
      discountRequestedPercent: new Prisma.Decimal(0),
      discountApprovedPercent: new Prisma.Decimal(0),
      total: new Prisma.Decimal(1000),
    });
    const orderUpdate = jest.fn();
    const { prisma, $transaction } = makePrisma({
      order: { findUnique, update: orderUpdate },
    });
    const { audit, record } = makeAudit();
    const service = new OrdersService(prisma, makeInventory(), audit);

    await expect(
      service.requestDiscount(seller, 'order-1', { percent: 5 }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(orderUpdate).not.toHaveBeenCalled();
    expect($transaction).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });
});

describe('OrdersService.updateStatus audit', () => {
  it('records an UPDATE with the before/after status on a status change', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: 'order-1',
      status: OrderStatus.CONFIRMED,
      sellerId: 'seller-1',
      warehouseId: 'w1',
      items: [],
    });
    const txOrderUpdate = jest
      .fn()
      .mockResolvedValue({ id: 'order-1', status: OrderStatus.PREPARING });
    const $transaction = jest.fn(
      async (cb: (tx: unknown) => Promise<unknown>) =>
        cb({ order: { update: txOrderUpdate } }),
    );
    const prisma = {
      order: { findUnique },
      $transaction,
    } as unknown as PrismaService;
    const { audit, record } = makeAudit();
    const service = new OrdersService(prisma, makeInventory(), audit);

    await service.updateStatus(seller, 'order-1', OrderStatus.PREPARING);

    expect(record).toHaveBeenCalledWith({
      userId: 'seller-user-1',
      action: AuditAction.UPDATE,
      entityType: 'Order',
      entityId: 'order-1',
      before: { status: OrderStatus.CONFIRMED },
      after: { status: OrderStatus.PREPARING },
    });
  });
});
