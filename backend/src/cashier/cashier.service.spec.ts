import { ConflictException, NotFoundException } from '@nestjs/common';
import { CashierService } from './cashier.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  CashierShiftStatus,
  Prisma,
  Role,
} from '../../generated/prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';

const seller: AuthenticatedUser = {
  id: 'seller-1',
  phone: '+998901234567',
  role: Role.SELLER,
  sellerId: 'seller-profile-1',
};

function makeAudit() {
  return {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as AuditService;
}

function makePrisma(
  overrides: {
    cashierShift?: Record<string, unknown>;
    payment?: Record<string, unknown>;
    return?: Record<string, unknown>;
    seller?: Record<string, unknown>;
  } = {},
) {
  return {
    cashierShift: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'shift-1' }),
      update: jest.fn().mockResolvedValue({}),
      ...overrides.cashierShift,
    },
    payment: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }),
      ...overrides.payment,
    },
    return: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { refundAmount: null } }),
      ...overrides.return,
    },
    seller: {
      findUnique: jest.fn().mockResolvedValue({ warehouseId: 'w1' }),
      ...overrides.seller,
    },
  } as unknown as PrismaService;
}

describe('CashierService.current', () => {
  it('returns null when there is no open shift', async () => {
    const service = new CashierService(makePrisma(), makeAudit());

    await expect(service.current(seller)).resolves.toBeNull();
  });

  it('attaches a live expectedBalance breakdown to the open shift', async () => {
    const prisma = makePrisma({
      cashierShift: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'shift-1',
          openingBalance: new Prisma.Decimal(500_000),
          openedAt: new Date('2026-09-11T08:00:00Z'),
        }),
      },
      payment: {
        aggregate: jest
          .fn()
          .mockResolvedValue({ _sum: { amount: new Prisma.Decimal(300_000) } }),
      },
      return: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { refundAmount: new Prisma.Decimal(50_000) },
        }),
      },
    });
    const service = new CashierService(prisma, makeAudit());

    const result = await service.current(seller);

    expect(result?.id).toBe('shift-1');
    expect(Number(result?.expectedBalance)).toBe(750_000);
    expect(Number(result?.cashSales)).toBe(300_000);
    expect(Number(result?.cashRefunds)).toBe(50_000);
  });
});

describe('CashierService.history', () => {
  it('lists closed shifts for this seller, most recent first, capped at the limit', async () => {
    const findMany = jest.fn().mockResolvedValue([{ id: 'shift-0' }]);
    const prisma = makePrisma({ cashierShift: { findMany } });
    const service = new CashierService(prisma, makeAudit());

    await service.history(seller, 10);

    expect(findMany).toHaveBeenCalledWith({
      where: { sellerId: seller.id, status: CashierShiftStatus.CLOSED },
      orderBy: { closedAt: 'desc' },
      take: 10,
    });
  });
});

describe('CashierService.open', () => {
  it('refuses to open a second shift while one is already open', async () => {
    const prisma = makePrisma({
      cashierShift: {
        findFirst: jest.fn().mockResolvedValue({ id: 'shift-0' }),
      },
    });
    const service = new CashierService(prisma, makeAudit());

    await expect(
      service.open(seller, { openingBalance: 100000 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('CashierService.close', () => {
  it('404s when there is no open shift to close', async () => {
    const service = new CashierService(makePrisma(), makeAudit());

    await expect(
      service.close(seller, { closingBalanceActual: 100000 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('computes expectedBalance = opening + cashSales - cashRefunds, and the actual/expected difference', async () => {
    const update = jest.fn().mockResolvedValue({});
    const prisma = makePrisma({
      cashierShift: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'shift-1',
          openingBalance: new Prisma.Decimal(500_000),
          openedAt: new Date('2026-09-11T08:00:00Z'),
        }),
        update,
      },
      payment: {
        aggregate: jest
          .fn()
          .mockResolvedValue({ _sum: { amount: new Prisma.Decimal(300_000) } }),
      },
      return: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { refundAmount: new Prisma.Decimal(50_000) },
        }),
      },
    });
    const service = new CashierService(prisma, makeAudit());

    // opening 500k + cash sales 300k - cash refunds 50k = expected 750k;
    // counted 760k => a 10k surplus.
    await service.close(seller, {
      closingBalanceActual: 760_000,
      comment: 'Ortiqcha naqd pul',
    });

    const calls = update.mock.calls as [{ data: Record<string, unknown> }][];
    const data = calls[0][0].data;
    expect(data.status).toBe(CashierShiftStatus.CLOSED);
    expect(Number(data.expectedBalance)).toBe(750_000);
    expect(Number(data.difference)).toBe(10_000);
  });

  it('requires a comment for a non-zero difference without closing the shift', async () => {
    const update = jest.fn();
    const service = new CashierService(
      makePrisma({
        cashierShift: {
          findFirst: jest.fn().mockResolvedValue({
            id: 's1',
            openingBalance: new Prisma.Decimal(100),
            openedAt: new Date(),
          }),
          update,
        },
      }),
      makeAudit(),
    );
    await expect(
      service.close(seller, { closingBalanceActual: 90, comment: '   ' }),
    ).rejects.toMatchObject({ response: { error: 'shift_comment_required' } });
    expect(update).not.toHaveBeenCalled();
  });
});
