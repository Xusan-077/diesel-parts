import { ConflictException, NotFoundException } from '@nestjs/common';
import { DiscountRequestsService } from './discount-requests.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  AuditAction,
  DiscountStatus,
  NotificationType,
  Prisma,
} from '../../generated/prisma/client';

const FIXED_NOW = new Date('2026-01-15T10:00:00.000Z');

function makeTx(
  overrides: {
    discountRequest?: Record<string, unknown>;
    order?: Record<string, unknown>;
    notification?: Record<string, unknown>;
  } = {},
) {
  return {
    discountRequest: {
      update: jest.fn().mockResolvedValue({}),
      ...overrides.discountRequest,
    },
    order: {
      update: jest.fn().mockResolvedValue({}),
      ...overrides.order,
    },
    notification: {
      create: jest.fn().mockResolvedValue({}),
      ...overrides.notification,
    },
  };
}

function makePrisma(
  overrides: {
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
    discountRequest: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      ...overrides.discountRequest,
    },
    $transaction,
  } as unknown as PrismaService;

  return { prisma, tx, $transaction };
}

/**
 * Returns the mocked `record` function alongside the `AuditService` it is
 * wired into, so a test can assert on `record` directly rather than reading
 * the method off the service object (which trips
 * `@typescript-eslint/unbound-method`).
 */
function makeAudit() {
  const record = jest.fn().mockResolvedValue(undefined);
  const audit = { record } as unknown as AuditService;
  return { audit, record };
}

describe('DiscountRequestsService', () => {
  describe('listPending', () => {
    it('scopes to PENDING, oldest first, and shapes each row', async () => {
      const findMany = jest.fn().mockResolvedValue([
        {
          id: 'req-1',
          orderId: 'order-1',
          requestedPercent: 15,
          reason: 'Loyal customer',
          createdAt: new Date('2026-01-01'),
          seller: { name: 'Ali', discountLimit: 5 },
          order: {
            orderNumber: 'DP-1001',
            subtotal: 1000,
            customer: { name: 'Akmal' },
          },
        },
      ]);
      const { prisma } = makePrisma({ discountRequest: { findMany } });
      const { audit } = makeAudit();
      const service = new DiscountRequestsService(prisma, audit);

      const result = await service.listPending();

      expect(findMany).toHaveBeenCalledWith({
        where: { status: DiscountStatus.PENDING },
        orderBy: { createdAt: 'asc' },
        include: {
          seller: { select: { name: true, discountLimit: true } },
          order: {
            select: {
              orderNumber: true,
              subtotal: true,
              customer: { select: { name: true } },
            },
          },
        },
      });
      expect(result).toEqual([
        {
          id: 'req-1',
          orderId: 'order-1',
          orderNumber: 'DP-1001',
          sellerName: 'Ali',
          sellerLimit: 5,
          customerName: 'Akmal',
          requestedPercent: 15,
          reason: 'Loyal customer',
          subtotal: 1000,
          totalIfApproved: 850,
          createdAt: new Date('2026-01-01'),
        },
      ]);
    });
  });

  describe('decide', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(FIXED_NOW);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('throws NotFoundException when the request does not exist', async () => {
      const { prisma } = makePrisma();
      const { audit } = makeAudit();
      const service = new DiscountRequestsService(prisma, audit);

      await expect(
        service.decide('missing', true, 'director-1', null),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ConflictException when the request was already decided', async () => {
      const findUnique = jest.fn().mockResolvedValue({
        id: 'req-1',
        status: DiscountStatus.APPROVED,
        requestedPercent: 10,
        sellerId: 'seller-user-1',
        orderId: 'order-1',
        order: { subtotal: 1000, discountApprovedPercent: 0 },
      });
      const { prisma } = makePrisma({ discountRequest: { findUnique } });
      const { audit } = makeAudit();
      const service = new DiscountRequestsService(prisma, audit);

      await expect(
        service.decide('req-1', true, 'director-1', null),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('on approval: updates the request, the order total, notifies the seller, and audits APPROVE', async () => {
      const findUnique = jest.fn().mockResolvedValue({
        id: 'req-1',
        status: DiscountStatus.PENDING,
        requestedPercent: 20,
        sellerId: 'seller-user-1',
        orderId: 'order-1',
        order: { subtotal: 1000, discountApprovedPercent: 0 },
      });
      const tx = makeTx();
      const { prisma } = makePrisma({ discountRequest: { findUnique }, tx });
      const { audit, record } = makeAudit();
      const service = new DiscountRequestsService(prisma, audit);

      const result = await service.decide('req-1', true, 'director-1', null);

      expect(tx.discountRequest.update).toHaveBeenCalledWith({
        where: { id: 'req-1' },
        data: {
          status: DiscountStatus.APPROVED,
          reviewedByUserId: 'director-1',
          reviewedAt: FIXED_NOW,
          decisionNote: null,
        },
      });
      // `discountApprovedPercent`/`totalAmount` are written as `Prisma.Decimal`
      // instances; comparing against freshly-built ones checks the value
      // without reaching into the mock's captured call arguments.
      expect(tx.order.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: {
          discountApprovedPercent: new Prisma.Decimal(20),
          totalAmount: new Prisma.Decimal(800),
        },
      });

      expect(tx.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'seller-user-1',
          type: NotificationType.DISCOUNT_DECIDED,
          entityId: 'order-1',
          message: '20% chegirma tasdiqlandi.',
        },
      });

      expect(record).toHaveBeenCalledWith({
        userId: 'director-1',
        action: AuditAction.APPROVE,
        entityType: 'DiscountRequest',
        entityId: 'req-1',
        before: { status: DiscountStatus.PENDING, requestedPercent: 20 },
        after: { status: DiscountStatus.APPROVED, note: null },
      });

      expect(result).toEqual({ id: 'req-1' });
    });

    it('on rejection: does not touch the order, notifies with the note appended, and audits REJECT', async () => {
      const findUnique = jest.fn().mockResolvedValue({
        id: 'req-1',
        status: DiscountStatus.PENDING,
        requestedPercent: 20,
        sellerId: 'seller-user-1',
        orderId: 'order-1',
        order: { subtotal: 1000, discountApprovedPercent: 0 },
      });
      const tx = makeTx();
      const { prisma } = makePrisma({ discountRequest: { findUnique }, tx });
      const { audit, record } = makeAudit();
      const service = new DiscountRequestsService(prisma, audit);

      await service.decide(
        'req-1',
        false,
        'director-1',
        'Too high for this customer',
      );

      expect(tx.order.update).not.toHaveBeenCalled();
      expect(tx.discountRequest.update).toHaveBeenCalledWith({
        where: { id: 'req-1' },
        data: {
          status: DiscountStatus.REJECTED,
          reviewedByUserId: 'director-1',
          reviewedAt: FIXED_NOW,
          decisionNote: 'Too high for this customer',
        },
      });
      expect(tx.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'seller-user-1',
          type: NotificationType.DISCOUNT_DECIDED,
          entityId: 'order-1',
          message: '20% chegirma rad etildi. Too high for this customer',
        },
      });
      expect(record).toHaveBeenCalledWith({
        userId: 'director-1',
        action: AuditAction.REJECT,
        entityType: 'DiscountRequest',
        entityId: 'req-1',
        before: { status: DiscountStatus.PENDING, requestedPercent: 20 },
        after: {
          status: DiscountStatus.REJECTED,
          note: 'Too high for this customer',
        },
      });
    });

    it('rejects without a note and omits the trailing space', async () => {
      const findUnique = jest.fn().mockResolvedValue({
        id: 'req-1',
        status: DiscountStatus.PENDING,
        requestedPercent: 12,
        sellerId: 'seller-user-1',
        orderId: 'order-1',
        order: { subtotal: 500, discountApprovedPercent: 0 },
      });
      const tx = makeTx();
      const { prisma } = makePrisma({ discountRequest: { findUnique }, tx });
      const { audit } = makeAudit();
      const service = new DiscountRequestsService(prisma, audit);

      await service.decide('req-1', false, 'director-1', null);

      expect(tx.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'seller-user-1',
          type: NotificationType.DISCOUNT_DECIDED,
          entityId: 'order-1',
          message: '12% chegirma rad etildi.',
        },
      });
    });
  });
});
