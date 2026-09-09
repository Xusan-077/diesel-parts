import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  AuditAction,
  OrderPaymentStatus,
  PaymentStatus,
  Prisma,
} from '../../generated/prisma/client';

const dec = (n: number) => new Prisma.Decimal(n);

function firstArg<T>(mock: jest.Mock): T {
  return (mock.mock.calls as unknown[][])[0][0] as T;
}

/** A prisma double whose method mocks the caller can override per test. */
function makePrisma() {
  const prisma = {
    payment: {
      aggregate: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      groupBy: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'pay-new' }),
    },
    expense: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn().mockResolvedValue({}),
    },
    order: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn(),
  };
  // Array form runs the queries; callback form is handed the same double.
  prisma.$transaction.mockImplementation((arg: unknown) =>
    typeof arg === 'function'
      ? (arg as (tx: unknown) => unknown)(prisma)
      : Promise.all(arg as Promise<unknown>[]),
  );
  return prisma;
}

/** The loosely-typed double, cast to what the service constructor expects. */
function asPrisma(prisma: ReturnType<typeof makePrisma>): PrismaService {
  return prisma as unknown as PrismaService;
}

function makeAudit() {
  const record = jest.fn().mockResolvedValue(undefined);
  return { audit: { record } as unknown as AuditService, record };
}

describe('FinanceService', () => {
  describe('summary', () => {
    it('totals income, expense, net profit and outstanding debt', async () => {
      const prisma = makePrisma();
      prisma.payment.aggregate.mockResolvedValue({
        _sum: { amount: dec(5_000_000) },
      });
      prisma.expense.aggregate.mockResolvedValue({
        _sum: { amount: dec(1_200_000) },
      });
      prisma.order.findMany.mockResolvedValue([
        { id: 'o1', customerId: 'c1', totalAmount: dec(3_000_000) },
        { id: 'o2', customerId: 'c1', totalAmount: dec(2_000_000) },
        { id: 'o3', customerId: 'c2', totalAmount: dec(1_000_000) },
      ]);
      prisma.payment.groupBy.mockResolvedValue([
        {
          orderId: 'o1',
          _sum: { amount: dec(1_000_000) },
          _max: { paidAt: new Date() },
        },
        {
          orderId: 'o3',
          _sum: { amount: dec(1_000_000) },
          _max: { paidAt: new Date() },
        }, // fully paid
      ]);

      const service = new FinanceService(asPrisma(prisma), makeAudit().audit);
      const result = await service.summary({});

      expect(result.totalIncome).toBe(5_000_000);
      expect(result.totalExpense).toBe(1_200_000);
      expect(result.netProfit).toBe(3_800_000);
      // o1: 3M-1M=2M, o2: 2M, o3: 1M-1M=0 → 4M outstanding
      expect(result.totalDebt).toBe(4_000_000);
      // every order on credit, matching the debt tab's "N ta qarzdor"
      expect(result.debtorCount).toBe(3);
    });

    it('scopes payments/expenses to a Tashkent day range when given', async () => {
      const prisma = makePrisma();
      prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: null } });
      const service = new FinanceService(asPrisma(prisma), makeAudit().audit);

      await service.summary({ dateFrom: '2026-09-01', dateTo: '2026-09-30' });

      const where = firstArg<{ where: { paidAt: { gte: Date; lt: Date } } }>(
        prisma.payment.aggregate,
      ).where;
      expect(where.paidAt.gte.toISOString()).toBe('2026-08-31T19:00:00.000Z');
      expect(where.paidAt.lt.toISOString()).toBe('2026-09-30T19:00:00.000Z');
    });
  });

  describe('payments', () => {
    it('lists COMPLETED payments only, flattened to the row shape', async () => {
      const prisma = makePrisma();
      prisma.payment.findMany.mockResolvedValue([
        {
          id: 'p1',
          amount: dec(1_500_000),
          method: 'CASH',
          paidAt: new Date('2026-09-08T09:12:00Z'),
          order: {
            id: 'o1',
            orderNumber: 'DP-2026-0042',
            customer: { id: 'c1', name: 'Anvar Karimov' },
          },
        },
      ]);
      prisma.payment.count.mockResolvedValue(1);

      const service = new FinanceService(asPrisma(prisma), makeAudit().audit);
      const result = await service.payments({ page: 1, limit: 20 });

      expect(
        firstArg<{ where: { status: string } }>(prisma.payment.findMany).where
          .status,
      ).toBe(PaymentStatus.COMPLETED);
      expect(result.data[0]).toEqual({
        id: 'p1',
        amount: 1_500_000,
        method: 'CASH',
        paidAt: new Date('2026-09-08T09:12:00Z'),
        order: { id: 'o1', orderNumber: 'DP-2026-0042' },
        customer: { id: 'c1', name: 'Anvar Karimov' },
      });
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });

    it('search matches order number or customer name', async () => {
      const prisma = makePrisma();
      const service = new FinanceService(asPrisma(prisma), makeAudit().audit);
      await service.payments({ page: 1, limit: 20, q: 'anvar' });

      const where = firstArg<{ where: { order: { OR: unknown[] } } }>(
        prisma.payment.findMany,
      ).where;
      expect(where.order.OR).toHaveLength(2);
    });
  });

  describe('expenses', () => {
    it('createExpense stores a Decimal amount at Tashkent midnight and audits CREATE', async () => {
      const prisma = makePrisma();
      prisma.expense.create.mockResolvedValue({
        id: 'e1',
        title: 'Sentyabr ijara',
        category: 'RENT',
        amount: dec(4_000_000),
        spentAt: new Date('2026-08-31T19:00:00Z'),
        note: null,
        createdAt: new Date(),
        createdBy: { id: 'u1', name: 'Director' },
      });
      const { audit, record } = makeAudit();
      const service = new FinanceService(asPrisma(prisma), audit);

      const row = await service.createExpense(
        {
          title: 'Sentyabr ijara',
          category: 'RENT',
          amount: 4_000_000,
          spentAt: '2026-09-01',
        },
        'u1',
        '10.0.0.1',
      );

      const data = firstArg<{ data: Record<string, unknown> }>(
        prisma.expense.create,
      ).data;
      expect(data.amount).toBeInstanceOf(Prisma.Decimal);
      expect((data.spentAt as Date).toISOString()).toBe(
        '2026-08-31T19:00:00.000Z',
      );
      expect(data.createdById).toBe('u1');
      expect(row.amount).toBe(4_000_000);
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.CREATE,
          entityType: 'Expense',
          ipAddress: '10.0.0.1',
        }),
      );
    });

    it('updateExpense 404s a missing row and never writes', async () => {
      const prisma = makePrisma();
      prisma.expense.findUnique.mockResolvedValue(null);
      const service = new FinanceService(asPrisma(prisma), makeAudit().audit);

      await expect(
        service.updateExpense('ghost', { title: 'x' }, 'u1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.expense.update).not.toHaveBeenCalled();
    });

    it('updateExpense applies only the provided fields and audits UPDATE', async () => {
      const prisma = makePrisma();
      const existing = {
        id: 'e1',
        title: 'old',
        category: 'RENT',
        amount: dec(1_000),
        spentAt: new Date('2026-08-31T19:00:00Z'),
        note: null,
        createdAt: new Date(),
        createdBy: { id: 'u1', name: 'D' },
      };
      prisma.expense.findUnique.mockResolvedValue(existing);
      prisma.expense.update.mockResolvedValue({ ...existing, title: 'new' });
      const { audit, record } = makeAudit();
      const service = new FinanceService(asPrisma(prisma), audit);

      await service.updateExpense('e1', { title: 'new' }, 'u1');

      const data = firstArg<{ data: Record<string, unknown> }>(
        prisma.expense.update,
      ).data;
      expect(data).toEqual({ title: 'new' });
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.UPDATE,
          entityType: 'Expense',
        }),
      );
    });

    it('deleteExpense hard-deletes and audits DELETE with a before snapshot', async () => {
      const prisma = makePrisma();
      prisma.expense.findUnique.mockResolvedValue({
        id: 'e1',
        title: 'wrong line',
        category: 'OTHER',
        amount: dec(500),
        spentAt: new Date('2026-08-31T19:00:00Z'),
        note: null,
        createdAt: new Date(),
        createdBy: { id: 'u1', name: 'D' },
      });
      const { audit, record } = makeAudit();
      const service = new FinanceService(asPrisma(prisma), audit);

      const result = await service.deleteExpense('e1', 'u1', '10.0.0.2');

      expect(prisma.expense.delete).toHaveBeenCalledWith({
        where: { id: 'e1' },
      });
      expect(result).toEqual({ success: true });
      const entry = firstArg<{ action: string; before: unknown }>(record);
      expect(entry.action).toBe(AuditAction.DELETE);
      expect(entry.before).toMatchObject({ title: 'wrong line' });
    });

    it('deleteExpense 404s a missing row', async () => {
      const prisma = makePrisma();
      prisma.expense.findUnique.mockResolvedValue(null);
      const service = new FinanceService(asPrisma(prisma), makeAudit().audit);

      await expect(service.deleteExpense('ghost', 'u1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.expense.delete).not.toHaveBeenCalled();
    });
  });

  describe('debts', () => {
    function seedDebts(prisma: ReturnType<typeof makePrisma>) {
      prisma.order.findMany.mockResolvedValue([
        {
          id: 'o1',
          orderNumber: 'DP-2026-0031',
          createdAt: new Date('2026-08-20T00:00:00Z'),
          totalAmount: dec(8_000_000),
          paymentStatus: OrderPaymentStatus.PARTIAL,
          customer: { id: 'c1', name: 'Anvar', phone: '998901234567' },
        },
        {
          id: 'o2',
          orderNumber: 'DP-2026-0032',
          createdAt: new Date('2026-08-25T00:00:00Z'),
          totalAmount: dec(1_000_000),
          paymentStatus: OrderPaymentStatus.UNPAID,
          customer: { id: 'c2', name: 'Bek', phone: null },
        },
      ]);
      prisma.payment.groupBy.mockResolvedValue([
        {
          orderId: 'o1',
          _sum: { amount: dec(3_000_000) },
          _max: { paidAt: new Date('2026-09-01T00:00:00Z') },
        },
      ]);
    }

    it('computes remaining, lastPaymentAt and the page totals', async () => {
      const prisma = makePrisma();
      seedDebts(prisma);
      const service = new FinanceService(asPrisma(prisma), makeAudit().audit);

      const result = await service.debts({ page: 1, limit: 20 });

      expect(result.data[0]).toMatchObject({
        orderId: 'o1',
        total: 8_000_000,
        paid: 3_000_000,
        remaining: 5_000_000,
        status: OrderPaymentStatus.PARTIAL,
        lastPaymentAt: new Date('2026-09-01T00:00:00Z'),
      });
      expect(result.data[1]).toMatchObject({
        remaining: 1_000_000,
        lastPaymentAt: null,
      });
      expect(result.totals).toEqual({ remaining: 6_000_000, count: 2 });
    });

    it('paginates in memory after the roll-up', async () => {
      const prisma = makePrisma();
      seedDebts(prisma);
      const service = new FinanceService(asPrisma(prisma), makeAudit().audit);

      const page2 = await service.debts({ page: 2, limit: 1 });
      expect(page2.data).toHaveLength(1);
      expect(page2.data[0].orderId).toBe('o2');
      expect(page2.totals.count).toBe(2);
    });
  });

  describe('recordDebtPayment', () => {
    function seedOrder(
      prisma: ReturnType<typeof makePrisma>,
      paidBefore: number,
    ) {
      prisma.order.findUnique.mockResolvedValue({
        id: 'o1',
        orderNumber: 'DP-2026-0031',
        createdAt: new Date('2026-08-20T00:00:00Z'),
        totalAmount: dec(8_000_000),
        paymentStatus: OrderPaymentStatus.PARTIAL,
        customer: { id: 'c1', name: 'Anvar', phone: '998901234567' },
      });
      prisma.payment.aggregate.mockResolvedValue({
        _sum: { amount: dec(paidBefore) },
      });
    }

    it('rejects an amount over the outstanding balance (nothing written)', async () => {
      const prisma = makePrisma();
      seedOrder(prisma, 3_000_000); // remaining 5M
      const service = new FinanceService(asPrisma(prisma), makeAudit().audit);

      await expect(
        service.recordDebtPayment(
          'o1',
          { amount: 6_000_000, method: 'CASH' },
          'u1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.payment.create).not.toHaveBeenCalled();
      expect(prisma.order.update).not.toHaveBeenCalled();
    });

    it('404s an unknown order', async () => {
      const prisma = makePrisma();
      prisma.order.findUnique.mockResolvedValue(null);
      const service = new FinanceService(asPrisma(prisma), makeAudit().audit);

      await expect(
        service.recordDebtPayment('ghost', { amount: 1, method: 'CASH' }, 'u1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('records a partial payment, keeps PARTIAL, audits PAYMENT', async () => {
      const prisma = makePrisma();
      seedOrder(prisma, 3_000_000);
      const { audit, record } = makeAudit();
      const service = new FinanceService(asPrisma(prisma), audit);

      const row = await service.recordDebtPayment(
        'o1',
        { amount: 2_000_000, method: 'CARD', paidAt: '2026-09-09' },
        'u1',
        '10.0.0.3',
      );

      const payment = firstArg<{ data: Record<string, unknown> }>(
        prisma.payment.create,
      ).data;
      expect(payment.status).toBe(PaymentStatus.COMPLETED);
      expect((payment.amount as Prisma.Decimal).toNumber()).toBe(2_000_000);
      expect((payment.paidAt as Date).toISOString()).toBe(
        '2026-09-08T19:00:00.000Z',
      );

      const orderUpdate = firstArg<{ data: { paymentStatus: string } }>(
        prisma.order.update,
      ).data;
      expect(orderUpdate.paymentStatus).toBe(OrderPaymentStatus.PARTIAL);

      expect(row).toMatchObject({
        paid: 5_000_000,
        remaining: 3_000_000,
        status: 'PARTIAL',
      });
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.PAYMENT,
          entityType: 'Order',
          entityId: 'o1',
          ipAddress: '10.0.0.3',
        }),
      );
    });

    it('flips the order to PAID once the balance is cleared', async () => {
      const prisma = makePrisma();
      seedOrder(prisma, 3_000_000);
      const service = new FinanceService(asPrisma(prisma), makeAudit().audit);

      const row = await service.recordDebtPayment(
        'o1',
        { amount: 5_000_000, method: 'TRANSFER' },
        'u1',
      );

      const orderUpdate = firstArg<{ data: { paymentStatus: string } }>(
        prisma.order.update,
      ).data;
      expect(orderUpdate.paymentStatus).toBe(OrderPaymentStatus.PAID);
      expect(row).toMatchObject({
        paid: 8_000_000,
        remaining: 0,
        status: 'PAID',
      });
    });
  });
});
