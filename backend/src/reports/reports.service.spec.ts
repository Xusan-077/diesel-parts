import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, Role } from '../../generated/prisma/client';
import type { ScopeActor } from '../common/scope';

const seller: ScopeActor = { id: 'seller-1', role: Role.SELLER };
const director: ScopeActor = { id: 'director-1', role: Role.DIRECTOR };

function firstArg<T>(mock: jest.Mock): T {
  const calls = mock.mock.calls as unknown[][];
  return calls[0][0] as T;
}

function makePrisma(
  overrides: {
    order?: Record<string, unknown>;
    orderItem?: Record<string, unknown>;
  } = {},
) {
  return {
    order: {
      findMany: jest.fn().mockResolvedValue([]),
      ...overrides.order,
    },
    orderItem: {
      findMany: jest.fn().mockResolvedValue([]),
      ...overrides.orderItem,
    },
  } as unknown as PrismaService;
}

describe('ReportsService.sellerDailySales', () => {
  it('scopes to the seller’s own orders by default', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new ReportsService(makePrisma({ order: { findMany } }));

    await service.sellerDailySales(seller, {});

    const { where } = firstArg<{ where: Record<string, unknown> }>(findMany);
    expect(where).toMatchObject({ sellerId: 'seller-1' });
  });

  it('does not scope by seller for a director', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new ReportsService(makePrisma({ order: { findMany } }));

    await service.sellerDailySales(director, {});

    const { where } = firstArg<{ where: Record<string, unknown> }>(findMany);
    expect(where).not.toHaveProperty('sellerId');
  });

  it('buckets orders by calendar day and totals each bucket', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        createdAt: new Date('2026-09-10T08:00:00Z'),
        totalAmount: new Prisma.Decimal(100),
      },
      {
        createdAt: new Date('2026-09-10T20:00:00Z'),
        totalAmount: new Prisma.Decimal(50),
      },
      {
        createdAt: new Date('2026-09-11T09:00:00Z'),
        totalAmount: new Prisma.Decimal(30),
      },
    ]);
    const service = new ReportsService(makePrisma({ order: { findMany } }));

    const result = await service.sellerDailySales(seller, {});

    expect(result.days).toEqual([
      { date: '2026-09-10', totalSales: 150, orderCount: 2 },
      { date: '2026-09-11', totalSales: 30, orderCount: 1 },
    ]);
    expect(result.totalSales).toBe(180);
    expect(result.orderCount).toBe(3);
  });
});

describe('ReportsService.sellerTopProducts', () => {
  it('sums qty/revenue per product and sorts by units sold', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        productId: 'p1',
        productName: 'Filter',
        qty: 2,
        unitPrice: new Prisma.Decimal(100),
      },
      {
        productId: 'p2',
        productName: 'Belt',
        qty: 5,
        unitPrice: new Prisma.Decimal(20),
      },
      {
        productId: 'p1',
        productName: 'Filter',
        qty: 3,
        unitPrice: new Prisma.Decimal(100),
      },
    ]);
    const service = new ReportsService(makePrisma({ orderItem: { findMany } }));

    const result = await service.sellerTopProducts(seller, {}, 10);

    expect(result).toEqual([
      { productId: 'p1', productName: 'Filter', qtySold: 5, revenue: 500 },
      { productId: 'p2', productName: 'Belt', qtySold: 5, revenue: 100 },
    ]);
  });

  it('respects the limit', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        productId: 'p1',
        productName: 'A',
        qty: 3,
        unitPrice: new Prisma.Decimal(10),
      },
      {
        productId: 'p2',
        productName: 'B',
        qty: 2,
        unitPrice: new Prisma.Decimal(10),
      },
      {
        productId: 'p3',
        productName: 'C',
        qty: 1,
        unitPrice: new Prisma.Decimal(10),
      },
    ]);
    const service = new ReportsService(makePrisma({ orderItem: { findMany } }));

    const result = await service.sellerTopProducts(seller, {}, 2);

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.productId)).toEqual(['p1', 'p2']);
  });
});
