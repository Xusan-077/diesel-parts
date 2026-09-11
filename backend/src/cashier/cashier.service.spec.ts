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
    await service.close(seller, { closingBalanceActual: 760_000 });

    const calls = update.mock.calls as [{ data: Record<string, unknown> }][];
    const data = calls[0][0].data;
    expect(data.status).toBe(CashierShiftStatus.CLOSED);
    expect(Number(data.expectedBalance)).toBe(750_000);
    expect(Number(data.difference)).toBe(10_000);
  });
});
