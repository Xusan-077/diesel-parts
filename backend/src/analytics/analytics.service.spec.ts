import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from '../../generated/prisma/client';

function makePrisma(
  overrides: {
    order?: Record<string, unknown>;
    orderItem?: Record<string, unknown>;
    product?: Record<string, unknown>;
    user?: Record<string, unknown>;
    seller?: Record<string, unknown>;
    inquiry?: Record<string, unknown>;
    discountRequest?: Record<string, unknown>;
  } = {},
) {
  return {
    order: {
      aggregate: jest.fn().mockResolvedValue({ _sum: {}, _count: { _all: 0 } }),
      findMany: jest.fn().mockResolvedValue([]),
      groupBy: jest.fn().mockResolvedValue([]),
      ...overrides.order,
    },
    orderItem: {
      groupBy: jest.fn().mockResolvedValue([]),
      findMany: jest.fn().mockResolvedValue([]),
      ...overrides.orderItem,
    },
    product: {
      findMany: jest.fn().mockResolvedValue([]),
      ...overrides.product,
    },
    user: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      ...overrides.user,
    },
    seller: {
      findMany: jest.fn().mockResolvedValue([]),
      ...overrides.seller,
    },
    inquiry: {
      count: jest.fn().mockResolvedValue(0),
      groupBy: jest.fn().mockResolvedValue([]),
      ...overrides.inquiry,
    },
    discountRequest: {
      count: jest.fn().mockResolvedValue(0),
      ...overrides.discountRequest,
    },
  } as unknown as PrismaService;
}

const WINDOW = {
  from: '2026-08-01T00:00:00.000Z',
  to: '2026-08-08T00:00:00.000Z',
  previousFrom: '2026-07-25T00:00:00.000Z',
  previousTo: '2026-08-01T00:00:00.000Z',
  days: 7,
};

describe('AnalyticsService.salesSummary', () => {
  it("splits revenue (COMPLETED) from pipeline (CONFIRMED + NEW, root's PENDING)", async () => {
    const aggregate = jest
      .fn()
      .mockResolvedValueOnce({ _sum: { total: 1000 }, _count: { _all: 4 } }) // current
      .mockResolvedValueOnce({ _sum: { total: 500 }, _count: { _all: 2 } }) // previous
      .mockResolvedValueOnce({ _sum: { total: 300 } }); // pipeline
    const prisma = makePrisma({ order: { aggregate } });
    const service = new AnalyticsService(prisma);

    const result = await service.salesSummary(WINDOW);

    expect(aggregate).toHaveBeenNthCalledWith(3, {
      where: { status: { in: [OrderStatus.CONFIRMED, OrderStatus.NEW] } },
      _sum: { total: true },
    });
    expect(result).toEqual({
      current: { revenue: 1000, orders: 4 },
      previous: { revenue: 500, orders: 2 },
      revenueChange: 100,
      ordersChange: 100,
      averageOrderValue: 250,
      pipelineValue: 300,
    });
  });

  it('reports revenueChange as null when the previous window earned nothing', async () => {
    const aggregate = jest
      .fn()
      .mockResolvedValueOnce({ _sum: { total: 500 }, _count: { _all: 1 } })
      .mockResolvedValueOnce({ _sum: { total: 0 }, _count: { _all: 0 } })
      .mockResolvedValueOnce({ _sum: {} });
    const prisma = makePrisma({ order: { aggregate } });
    const service = new AnalyticsService(prisma);

    const result = await service.salesSummary(WINDOW);

    expect(result.revenueChange).toBeNull();
  });
});

describe('AnalyticsService.orderStatusBreakdown', () => {
  it('counts PREPARING as open, matching root\'s "still moving" bucket', async () => {
    const groupBy = jest.fn().mockResolvedValue([
      { status: OrderStatus.DRAFT, _count: { _all: 1 } },
      { status: OrderStatus.NEW, _count: { _all: 2 } },
      { status: OrderStatus.CONFIRMED, _count: { _all: 3 } },
      { status: OrderStatus.PREPARING, _count: { _all: 4 } },
      { status: OrderStatus.COMPLETED, _count: { _all: 5 } },
      { status: OrderStatus.CANCELLED, _count: { _all: 6 } },
    ]);
    const prisma = makePrisma({ order: { groupBy } });
    const service = new AnalyticsService(prisma);

    const result = await service.orderStatusBreakdown(WINDOW);

    expect(result).toEqual({ completed: 5, open: 1 + 2 + 3 + 4, cancelled: 6 });
  });
});

describe('AnalyticsService.recentOrders', () => {
  it("joins the seller's name through Seller.user, not the seller row itself", async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'o1',
        orderNumber: 'ORD-1',
        status: OrderStatus.COMPLETED,
        total: 1500,
        createdAt: new Date('2026-08-01'),
        customer: { name: 'Aziz' },
        seller: { user: { name: 'Vali' } },
      },
    ]);
    const prisma = makePrisma({ order: { findMany } });
    const service = new AnalyticsService(prisma);

    const result = await service.recentOrders(6);

    expect(result).toEqual([
      {
        id: 'o1',
        orderNumber: 'ORD-1',
        customerName: 'Aziz',
        sellerName: 'Vali',
        status: OrderStatus.COMPLETED,
        total: 1500,
        createdAt: new Date('2026-08-01'),
      },
    ]);
  });
});

describe('AnalyticsService.sellerPerformance', () => {
  it('re-keys the grouped sellerId (Seller.id) through Seller.userId before joining a name', async () => {
    const groupBy = jest
      .fn()
      .mockResolvedValue([
        { sellerId: 'seller-1', _sum: { total: 900 }, _count: { _all: 3 } },
      ]);
    const sellerFindMany = jest
      .fn()
      .mockResolvedValue([{ id: 'seller-1', userId: 'user-1' }]);
    const userFindMany = jest
      .fn()
      .mockResolvedValue([{ id: 'user-1', name: 'Vali' }]);
    const prisma = makePrisma({
      order: { groupBy },
      seller: { findMany: sellerFindMany },
      user: { findMany: userFindMany },
    });
    const service = new AnalyticsService(prisma);

    const result = await service.sellerPerformance(WINDOW);

    expect(result).toEqual([
      { sellerId: 'user-1', name: 'Vali', revenue: 900, orders: 3 },
    ]);
  });
});

describe('AnalyticsService.dashboardCounts', () => {
  it('counts NEW inquiries, PENDING discount requests and active sellers', async () => {
    const inquiryCount = jest.fn().mockResolvedValue(4);
    const discountCount = jest.fn().mockResolvedValue(2);
    const userCount = jest.fn().mockResolvedValue(6);
    const prisma = makePrisma({
      inquiry: { count: inquiryCount },
      discountRequest: { count: discountCount },
      user: { count: userCount },
    });
    const service = new AnalyticsService(prisma);

    const result = await service.dashboardCounts();

    expect(inquiryCount).toHaveBeenCalledWith({ where: { status: 'NEW' } });
    expect(discountCount).toHaveBeenCalledWith({
      where: { status: 'PENDING' },
    });
    expect(userCount).toHaveBeenCalledWith({
      where: { role: 'SELLER', isActive: true },
    });
    expect(result).toEqual({
      newInquiries: 4,
      pendingDiscounts: 2,
      activeSellers: 6,
    });
  });
});

describe('AnalyticsService.productMovement', () => {
  it('sums Inventory quantity minus reserved for current stock, and ranks fast movers by units sold', async () => {
    const groupBy = jest
      .fn()
      .mockResolvedValue([{ productId: 'p1', _sum: { quantity: 12 } }]);
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'p1',
        sku: 'DP-1',
        nameUz: 'Nasos',
        minStock: 2,
        inventories: [{ quantity: 10, reservedQuantity: 2 }],
      },
      {
        id: 'p2',
        sku: 'DP-2',
        nameUz: 'Filtr',
        minStock: 1,
        inventories: [{ quantity: 5, reservedQuantity: 0 }],
      },
    ]);
    const lineFindMany = jest
      .fn()
      .mockResolvedValue([{ productId: 'p1', quantity: 12, price: 100 }]);
    const prisma = makePrisma({
      orderItem: { groupBy, findMany: lineFindMany },
      product: { findMany },
    });
    const service = new AnalyticsService(prisma);

    const result = await service.productMovement(WINDOW, 10);

    expect(result.fastMoving).toEqual([
      {
        id: 'p1',
        sku: 'DP-1',
        name: 'Nasos',
        unitsSold: 12,
        revenue: 1200,
        stock: 8,
        coverPeriods: 8 / 12,
      },
    ]);
    expect(result.deadStock).toEqual([
      {
        id: 'p2',
        sku: 'DP-2',
        name: 'Filtr',
        unitsSold: 0,
        revenue: 0,
        stock: 5,
        coverPeriods: null,
      },
    ]);
  });
});

describe('AnalyticsService.sellerScorecards', () => {
  it('drops sellers with no orders and no inquiries in the window', async () => {
    const groupBy = jest.fn().mockResolvedValue([]);
    const userFindMany = jest
      .fn()
      .mockResolvedValue([{ id: 'user-1', name: 'Vali' }]);
    const prisma = makePrisma({
      order: { groupBy },
      user: { findMany: userFindMany },
    });
    const service = new AnalyticsService(prisma);

    const result = await service.sellerScorecards(WINDOW);

    expect(result).toEqual([]);
  });

  it('counts an inquiry as converted only once even if it produced several orders', async () => {
    const orderGroupBy = jest.fn().mockResolvedValue([
      {
        sellerId: 'seller-1',
        status: OrderStatus.COMPLETED,
        _sum: { total: 500 },
        _count: { _all: 2 },
      },
    ]);
    const sellerFindMany = jest
      .fn()
      .mockResolvedValue([{ id: 'seller-1', userId: 'user-1' }]);
    const userFindMany = jest
      .fn()
      .mockResolvedValue([{ id: 'user-1', name: 'Vali' }]);
    const inquiryGroupBy = jest
      .fn()
      .mockResolvedValue([{ assignedSellerId: 'user-1', _count: { _all: 1 } }]);
    const orderFindMany = jest.fn().mockResolvedValue([
      { sellerId: 'seller-1', inquiryId: 'inq-1' },
      { sellerId: 'seller-1', inquiryId: 'inq-1' },
    ]);
    const prisma = makePrisma({
      order: { groupBy: orderGroupBy, findMany: orderFindMany },
      seller: { findMany: sellerFindMany },
      user: { findMany: userFindMany },
      inquiry: { groupBy: inquiryGroupBy },
    });
    const service = new AnalyticsService(prisma);

    const result = await service.sellerScorecards(WINDOW);

    expect(result[0].inquiries).toBe(1);
    expect(result[0].conversionRate).toBe(100);
  });
});

describe('AnalyticsService.customerAnalytics', () => {
  it('splits new from returning by whether the customer ordered before this window', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        customerId: 'c1',
        total: 200,
        customer: { id: 'c1', name: 'Aziz', company: null },
      },
      {
        customerId: 'c2',
        total: 300,
        customer: { id: 'c2', name: 'Bek', company: 'OOO Bek' },
      },
    ]);
    const earlierGroupBy = jest
      .fn()
      .mockResolvedValue([{ customerId: 'c2', _count: { _all: 1 } }]);
    const prisma = makePrisma({
      order: { findMany, groupBy: earlierGroupBy },
    });
    const service = new AnalyticsService(prisma);

    const result = await service.customerAnalytics(WINDOW, 10);

    expect(result.newCustomers).toBe(1);
    expect(result.returningCustomers).toBe(1);
    expect(result.topCustomers[0]).toMatchObject({ id: 'c2', revenue: 300 });
  });
});
