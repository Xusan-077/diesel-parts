import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { OrdersService, ORDER_INCLUDE } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { ProductsService } from '../products/products.service';
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

interface IncludeArgs {
  include: {
    discountRequests?: unknown;
    seller: { select: Record<string, boolean> };
  };
}

interface OrderDataArgs {
  data: {
    status?: OrderStatus;
    sellerId?: string;
    warehouseId?: string | null;
    subtotal?: Prisma.Decimal;
    totalAmount?: Prisma.Decimal;
    items?: {
      create: {
        unitPrice: Prisma.Decimal;
        qty: number;
      }[];
    };
  };
}

function firstArg<T>(mock: jest.Mock): T {
  const calls = mock.mock.calls as unknown[][];
  return calls[0][0] as T;
}

interface AuditRow {
  action: AuditAction;
  entityType: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

/** Every `Order` `UPDATE` audit row recorded, in call order. */
function orderUpdateAudits(record: jest.Mock): AuditRow[] {
  return (record.mock.calls as unknown[][])
    .map((call) => call[0] as AuditRow)
    .filter(
      (row) => row.action === AuditAction.UPDATE && row.entityType === 'Order',
    );
}

// `id` is the user id — what `Order.sellerId` (a FK to `User`) is matched
// against. `sellerId` is the separate `Seller` profile id, deliberately a
// different value so a test that passed if the two were conflated fails.
const seller: AuthenticatedUser = {
  id: 'seller-user-1',
  phone: '+998901234567',
  role: Role.SELLER,
  sellerId: 'seller-1',
};

const director: AuthenticatedUser = {
  id: 'director-user-1',
  phone: '+998900000000',
  role: Role.DIRECTOR,
  sellerId: null,
};

function makeTx(
  overrides: {
    discountRequest?: Record<string, unknown>;
    order?: Record<string, unknown>;
    orderItem?: Record<string, unknown>;
    customer?: Record<string, unknown>;
    notification?: Record<string, unknown>;
  } = {},
) {
  return {
    discountRequest: {
      create: jest.fn().mockResolvedValue({ id: 'req-1' }),
      ...overrides.discountRequest,
    },
    order: {
      create: jest.fn().mockResolvedValue({
        id: 'order-1',
        orderNumber: 'DP-1002',
        customerId: 'cus-1',
        status: OrderStatus.PENDING,
        totalAmount: new Prisma.Decimal(200),
      }),
      update: jest.fn().mockResolvedValue({}),
      ...overrides.order,
    },
    orderItem: {
      deleteMany: jest.fn().mockResolvedValue({}),
      createMany: jest.fn().mockResolvedValue({}),
      ...overrides.orderItem,
    },
    customer: {
      update: jest.fn().mockResolvedValue({}),
      ...overrides.customer,
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
    orderItem?: Record<string, unknown>;
    orderSequence?: Record<string, unknown>;
    user?: Record<string, unknown>;
    seller?: Record<string, unknown>;
    customer?: Record<string, unknown>;
    inquiry?: Record<string, unknown>;
    product?: Record<string, unknown>;
    discountRequest?: Record<string, unknown>;
    tx?: ReturnType<typeof makeTx>;
  } = {},
) {
  const tx = overrides.tx ?? makeTx();
  const $transaction = jest.fn((arg: unknown) =>
    Array.isArray(arg)
      ? Promise.all(arg as unknown[])
      : (arg as (t: ReturnType<typeof makeTx>) => Promise<unknown>)(tx),
  );

  const prisma = {
    order: {
      findUnique: jest.fn().mockResolvedValue(null),
      findUniqueOrThrow: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn().mockResolvedValue({}),
      ...overrides.order,
    },
    orderItem: {
      deleteMany: jest.fn().mockResolvedValue({}),
      createMany: jest.fn().mockResolvedValue({}),
      ...overrides.orderItem,
    },
    orderSequence: {
      upsert: jest.fn().mockResolvedValue({ lastNumber: 1002 }),
      ...overrides.orderSequence,
    },
    user: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({ discountLimit: 10 }),
      findMany: jest.fn().mockResolvedValue([]),
      ...overrides.user,
    },
    seller: {
      findUniqueOrThrow: jest
        .fn()
        .mockResolvedValue({ id: 'seller-1', warehouseId: 'w1' }),
      ...overrides.seller,
    },
    customer: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ id: 'cus-1', assignedSellerId: 'seller-user-1' }),
      ...overrides.customer,
    },
    inquiry: {
      findFirst: jest.fn().mockResolvedValue({ id: 'inq-1' }),
      ...overrides.inquiry,
    },
    product: {
      findMany: jest.fn().mockResolvedValue([]),
      ...overrides.product,
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
  return {
    reserveForOrder: jest.fn().mockResolvedValue(undefined),
    fulfillForOrder: jest.fn().mockResolvedValue(undefined),
    releaseForOrder: jest.fn().mockResolvedValue(undefined),
  } as unknown as InventoryService;
}

function makeProducts(availableQuantity = 1000) {
  const stock = jest
    .fn()
    .mockResolvedValue({ totals: { availableQuantity }, byWarehouse: [] });
  const products = { stock } as unknown as ProductsService;
  return { products, stock };
}

function product(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'prod-1',
    sku: 'SKU-1',
    nameEn: 'Fuel Filter',
    price: new Prisma.Decimal(100),
    isActive: true,
    ...overrides,
  };
}

async function catchError(promise: Promise<unknown>): Promise<unknown> {
  let value: unknown;
  try {
    value = await promise;
  } catch (error) {
    return error;
  }
  throw new Error(
    `expected the call to reject but it resolved with ${JSON.stringify(value)}`,
  );
}

describe('OrdersService includes', () => {
  it('findOne requests discountRequests and the seller name off User directly', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: 'order-1',
      sellerId: 'seller-user-1',
    });
    const { prisma } = makePrisma({ order: { findUnique } });
    const { products } = makeProducts();
    const { audit } = makeAudit();
    const service = new OrdersService(prisma, makeInventory(), products, audit);

    await service.findOne(seller, 'order-1');

    const { include } = firstArg<IncludeArgs>(findUnique);
    expect(include.discountRequests).toBeDefined();
    expect(include.seller.select.name).toBe(true);
  });

  it('findAll does not request discountRequests', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const { prisma } = makePrisma({ order: { findMany, count } });
    const { products } = makeProducts();
    const { audit } = makeAudit();
    const service = new OrdersService(prisma, makeInventory(), products, audit);

    await service.findAll(seller, {});

    const { include } = firstArg<IncludeArgs>(findMany);
    expect(include.discountRequests).toBeUndefined();
    expect(include.seller.select.name).toBe(true);
  });

  // `Order.seller` is a FK to `User`. `ORDER_INCLUDE` is an `as const` object,
  // so TS excess-property checks don't fire on it — a stale nested key (the
  // old `seller: { select: { user: {...} } }`) compiled fine and only threw at
  // query time. This validates every selected column against the real `User`
  // columns from the generated client, catching that class of drift in `jest`.
  it('ORDER_INCLUDE.seller selects only real User columns', () => {
    const userColumns = new Set<string>(
      Object.values(Prisma.UserScalarFieldEnum),
    );
    const selected = Object.keys(ORDER_INCLUDE.seller.select);

    expect(selected.length).toBeGreaterThan(0);
    for (const column of selected) {
      expect(userColumns).toContain(column);
    }
  });
});

describe('OrdersService ownership scoping (Order.sellerId is a User FK)', () => {
  it('findAll scopes a SELLER to orders under their user id, not their Seller profile id', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const { prisma } = makePrisma({ order: { findMany, count } });
    const { products } = makeProducts();
    const { audit } = makeAudit();
    const service = new OrdersService(prisma, makeInventory(), products, audit);

    await service.findAll(seller, {});

    const { where } = firstArg<{ where: { sellerId?: string } }>(findMany);
    expect(where.sellerId).toBe(seller.id);
    expect(where.sellerId).not.toBe(seller.sellerId);
  });

  it('findAll does not scope a director', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const { prisma } = makePrisma({ order: { findMany, count } });
    const { products } = makeProducts();
    const { audit } = makeAudit();
    const service = new OrdersService(prisma, makeInventory(), products, audit);

    await service.findAll(director, {});

    expect(
      firstArg<{ where: { sellerId?: string } }>(findMany).where.sellerId,
    ).toBeUndefined();
  });

  it('findOne lets a SELLER read their own order and 403s another seller’s', async () => {
    const own = jest.fn().mockResolvedValue({
      id: 'order-1',
      sellerId: seller.id,
    });
    const { prisma: ownPrisma } = makePrisma({ order: { findUnique: own } });
    const { products } = makeProducts();
    const { audit } = makeAudit();
    const service = new OrdersService(
      ownPrisma,
      makeInventory(),
      products,
      audit,
    );

    await expect(service.findOne(seller, 'order-1')).resolves.toMatchObject({
      id: 'order-1',
    });

    const foreign = jest.fn().mockResolvedValue({
      id: 'order-2',
      sellerId: 'another-user',
    });
    const { prisma: foreignPrisma } = makePrisma({
      order: { findUnique: foreign },
    });
    const foreignService = new OrdersService(
      foreignPrisma,
      makeInventory(),
      products,
      audit,
    );

    await expect(
      foreignService.findOne(seller, 'order-2'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('OrdersService.create', () => {
  const dto = {
    customerId: 'cus-1',
    items: [{ productId: 'prod-1', quantity: 2, price: 999 }],
  };

  it('snapshots the catalog price and ignores the caller price', async () => {
    const tx = makeTx();
    const { prisma } = makePrisma({
      product: { findMany: jest.fn().mockResolvedValue([product()]) },
      tx,
    });
    const { products } = makeProducts();
    const { audit } = makeAudit();
    const service = new OrdersService(prisma, makeInventory(), products, audit);

    await service.create(seller, dto);

    const { data } = firstArg<OrderDataArgs>(tx.order.create);
    expect(data.subtotal).toEqual(new Prisma.Decimal(200));
    expect(data.totalAmount).toEqual(new Prisma.Decimal(200));
    expect(data.items!.create[0]).toMatchObject({
      unitPrice: new Prisma.Decimal(100),
      qty: 2,
    });
  });

  it('uses the line price when the product is priced on request', async () => {
    const tx = makeTx();
    const { prisma } = makePrisma({
      product: {
        findMany: jest.fn().mockResolvedValue([product({ price: null })]),
      },
      tx,
    });
    const { products } = makeProducts();
    const { audit } = makeAudit();
    const service = new OrdersService(prisma, makeInventory(), products, audit);

    await service.create(seller, {
      customerId: 'cus-1',
      items: [{ productId: 'prod-1', quantity: 1, price: 50 }],
    });

    expect(
      firstArg<OrderDataArgs>(tx.order.create).data.items!.create[0].unitPrice,
    ).toEqual(new Prisma.Decimal(50));
  });

  it('rejects a request-priced product with no price (price_required)', async () => {
    const { prisma } = makePrisma({
      product: {
        findMany: jest.fn().mockResolvedValue([product({ price: null })]),
      },
    });
    const { products } = makeProducts();
    const { audit } = makeAudit();
    const service = new OrdersService(prisma, makeInventory(), products, audit);

    const error = await catchError(
      service.create(seller, {
        customerId: 'cus-1',
        items: [{ productId: 'prod-1', quantity: 1 }],
      }),
    );
    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getResponse()).toMatchObject({
      error: 'price_required',
      productId: 'prod-1',
    });
  });

  it('rejects an over-stock order with a structured insufficient_stock body', async () => {
    const { prisma } = makePrisma({
      product: { findMany: jest.fn().mockResolvedValue([product()]) },
    });
    const { products } = makeProducts(1);
    const { audit } = makeAudit();
    const service = new OrdersService(prisma, makeInventory(), products, audit);

    const error = await catchError(
      service.create(seller, {
        customerId: 'cus-1',
        items: [{ productId: 'prod-1', quantity: 5 }],
      }),
    );
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({
      error: 'insufficient_stock',
      productId: 'prod-1',
      productName: 'Fuel Filter',
      requested: 5,
      available: 1,
    });
  });

  it('rejects an unknown inquiry (inquiry_not_found)', async () => {
    const { prisma } = makePrisma({
      product: { findMany: jest.fn().mockResolvedValue([product()]) },
      inquiry: { findFirst: jest.fn().mockResolvedValue(null) },
    });
    const { products } = makeProducts();
    const { audit } = makeAudit();
    const service = new OrdersService(prisma, makeInventory(), products, audit);

    const error = await catchError(
      service.create(seller, { ...dto, inquiryId: 'inq-x' }),
    );
    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getResponse()).toMatchObject({
      error: 'inquiry_not_found',
    });
  });

  it('rejects a customer the caller may not use (customer_not_found)', async () => {
    const { prisma } = makePrisma({
      customer: { findFirst: jest.fn().mockResolvedValue(null) },
    });
    const { products } = makeProducts();
    const { audit } = makeAudit();
    const service = new OrdersService(prisma, makeInventory(), products, audit);

    const error = await catchError(service.create(seller, dto));
    expect(error).toBeInstanceOf(NotFoundException);
    expect((error as NotFoundException).getResponse()).toMatchObject({
      error: 'customer_not_found',
    });
  });

  it('claims a pooled customer for a seller', async () => {
    const tx = makeTx();
    const { prisma } = makePrisma({
      customer: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'cus-1', assignedSellerId: null }),
      },
      product: { findMany: jest.fn().mockResolvedValue([product()]) },
      tx,
    });
    const { products } = makeProducts();
    const { audit } = makeAudit();
    const service = new OrdersService(prisma, makeInventory(), products, audit);

    await service.create(seller, dto);

    expect(tx.customer.update).toHaveBeenCalledWith({
      where: { id: 'cus-1' },
      data: { assignedSellerId: 'seller-user-1' },
    });
  });

  it('does not claim a pooled customer for a director', async () => {
    const tx = makeTx();
    const { prisma } = makePrisma({
      customer: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'cus-1', assignedSellerId: null }),
      },
      seller: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ id: 'seller-9', warehouseId: null }),
      },
      product: { findMany: jest.fn().mockResolvedValue([product()]) },
      tx,
    });
    const { products } = makeProducts();
    const { audit } = makeAudit();
    const service = new OrdersService(prisma, makeInventory(), products, audit);

    await service.create({ ...director, sellerId: 'seller-9' }, dto);

    expect(tx.customer.update).not.toHaveBeenCalled();
  });

  it('creates a PENDING order and records a CREATE audit', async () => {
    const tx = makeTx();
    const { prisma } = makePrisma({
      product: { findMany: jest.fn().mockResolvedValue([product()]) },
      tx,
    });
    const { products } = makeProducts();
    const { audit, record } = makeAudit();
    const service = new OrdersService(prisma, makeInventory(), products, audit);

    const result = await service.create(seller, dto);

    const { data } = firstArg<OrderDataArgs>(tx.order.create);
    expect(data.status).toBe(OrderStatus.PENDING);
    // `Order.sellerId` is a FK to `User` — the order is written under the
    // actor's user id, NOT their `Seller` profile id (`seller.sellerId`,
    // 'seller-1'), which would be a dangling FK.
    expect(data.sellerId).toBe(seller.id);
    expect(data.sellerId).not.toBe(seller.sellerId);
    expect(result).toMatchObject({ id: 'order-1' });
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.CREATE,
        entityType: 'Order',
        entityId: 'order-1',
      }),
    );
  });

  it('looks the Seller profile up by userId (for its default warehouse), not by actor.sellerId', async () => {
    const tx = makeTx();
    const sellerFindUniqueOrThrow = jest
      .fn()
      .mockResolvedValue({ id: 'seller-1', warehouseId: 'w1' });
    const { prisma } = makePrisma({
      seller: { findUniqueOrThrow: sellerFindUniqueOrThrow },
      product: { findMany: jest.fn().mockResolvedValue([product()]) },
      tx,
    });
    const { products } = makeProducts();
    const { audit } = makeAudit();
    const service = new OrdersService(prisma, makeInventory(), products, audit);

    await service.create(seller, dto);

    expect(sellerFindUniqueOrThrow).toHaveBeenCalledWith({
      where: { userId: seller.id },
    });
    expect(firstArg<OrderDataArgs>(tx.order.create).data.warehouseId).toBe(
      'w1',
    );
  });

  it('gives up with number_conflict after 3 P2002 collisions', async () => {
    const tx = makeTx({
      order: {
        create: jest.fn().mockRejectedValue({ code: 'P2002' }),
        update: jest.fn(),
      },
    });
    const { prisma } = makePrisma({
      product: { findMany: jest.fn().mockResolvedValue([product()]) },
      tx,
    });
    const { products } = makeProducts();
    const { audit } = makeAudit();
    const service = new OrdersService(prisma, makeInventory(), products, audit);

    const error = await catchError(service.create(seller, dto));
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({
      error: 'number_conflict',
    });
    expect(tx.order.create).toHaveBeenCalledTimes(3);
  });
});

describe('OrdersService.update', () => {
  it('throws NotFoundException when the order is missing', async () => {
    const { prisma } = makePrisma({
      order: { findUnique: jest.fn().mockResolvedValue(null) },
    });
    const { products } = makeProducts();
    const { audit } = makeAudit();
    const service = new OrdersService(prisma, makeInventory(), products, audit);

    await expect(
      service.update(seller, 'order-1', { notes: 'hi' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses to re-line a CONFIRMED order (locked)', async () => {
    const { prisma } = makePrisma({
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'order-1',
          sellerId: 'seller-user-1',
          status: OrderStatus.CONFIRMED,
          items: [],
        }),
      },
    });
    const { products } = makeProducts();
    const { audit } = makeAudit();
    const service = new OrdersService(prisma, makeInventory(), products, audit);

    const error = await catchError(
      service.update(seller, 'order-1', {
        items: [{ productId: 'prod-1', quantity: 1 }],
      }),
    );
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({
      error: 'locked',
    });
  });

  it('refuses an illegal status transition', async () => {
    const { prisma } = makePrisma({
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'order-1',
          sellerId: 'seller-user-1',
          status: OrderStatus.PENDING,
          items: [],
        }),
      },
    });
    const { products } = makeProducts();
    const { audit } = makeAudit();
    const service = new OrdersService(prisma, makeInventory(), products, audit);

    const error = await catchError(
      service.update(seller, 'order-1', { status: OrderStatus.COMPLETED }),
    );
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({
      error: 'illegal_transition',
      from: OrderStatus.PENDING,
      to: OrderStatus.COMPLETED,
    });
  });

  it('records exactly one audit row for a pure status change (the updateStatus one)', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: 'order-1',
      sellerId: 'seller-user-1',
      status: OrderStatus.CONFIRMED,
      warehouseId: 'w1',
      subtotal: new Prisma.Decimal(200),
      totalAmount: new Prisma.Decimal(180),
      notes: null,
      items: [],
    });
    const findUniqueOrThrow = jest.fn().mockResolvedValue({
      status: OrderStatus.COMPLETED,
      subtotal: new Prisma.Decimal(200),
      totalAmount: new Prisma.Decimal(180),
      notes: null,
      items: [],
    });
    const tx = makeTx({
      order: {
        create: jest.fn(),
        update: jest
          .fn()
          .mockResolvedValue({ id: 'order-1', status: OrderStatus.COMPLETED }),
      },
    });
    const { prisma } = makePrisma({
      order: { findUnique, findUniqueOrThrow },
      tx,
    });
    const { products } = makeProducts();
    const { audit, record } = makeAudit();
    const service = new OrdersService(prisma, makeInventory(), products, audit);

    await service.update(seller, 'order-1', { status: OrderStatus.COMPLETED });

    const rows = orderUpdateAudits(record);
    expect(rows).toHaveLength(1);
    expect(rows[0].before).toEqual({ status: OrderStatus.CONFIRMED });
    expect(rows[0].after).toEqual({ status: OrderStatus.COMPLETED });
  });

  it('combined status + re-line: the updateStatus status row plus one content row that omits status', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: 'order-1',
      sellerId: 'seller-user-1',
      status: OrderStatus.PENDING,
      warehouseId: 'w1',
      discountApprovedPercent: new Prisma.Decimal(10),
      subtotal: new Prisma.Decimal(0),
      totalAmount: new Prisma.Decimal(0),
      notes: null,
      items: [],
    });
    const findUniqueOrThrow = jest.fn().mockResolvedValue({
      status: OrderStatus.CONFIRMED,
      subtotal: new Prisma.Decimal(200),
      totalAmount: new Prisma.Decimal(180),
      notes: null,
      items: [{ id: 'li-1' }],
    });
    const tx = makeTx({
      order: {
        create: jest.fn(),
        update: jest
          .fn()
          .mockResolvedValue({ id: 'order-1', status: OrderStatus.CONFIRMED }),
      },
    });
    const { prisma } = makePrisma({
      order: { findUnique, findUniqueOrThrow },
      product: { findMany: jest.fn().mockResolvedValue([product()]) },
      tx,
    });
    const { products } = makeProducts();
    const { audit, record } = makeAudit();
    const service = new OrdersService(prisma, makeInventory(), products, audit);

    await service.update(seller, 'order-1', {
      status: OrderStatus.CONFIRMED,
      items: [{ productId: 'prod-1', quantity: 2 }],
    });

    const rows = orderUpdateAudits(record);
    expect(rows).toHaveLength(2);

    const statusRow = rows.find((row) => 'status' in (row.after ?? {}));
    expect(statusRow?.after).toEqual({ status: OrderStatus.CONFIRMED });

    const contentRow = rows.find((row) => !('status' in (row.after ?? {})));
    expect(contentRow).toBeDefined();
    expect(contentRow!.after).not.toHaveProperty('status');
    expect(contentRow!.after).toMatchObject({ subtotal: 200, total: 180 });
  });

  it('re-lines and recomputes subtotal/total against the approved percent, recording one content audit row', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: 'order-1',
      sellerId: 'seller-user-1',
      status: OrderStatus.PENDING,
      discountApprovedPercent: new Prisma.Decimal(10),
      subtotal: new Prisma.Decimal(0),
      totalAmount: new Prisma.Decimal(0),
      notes: null,
      items: [],
    });
    const findUniqueOrThrow = jest.fn().mockResolvedValue({
      status: OrderStatus.PENDING,
      subtotal: new Prisma.Decimal(200),
      totalAmount: new Prisma.Decimal(180),
      notes: null,
      items: [{ id: 'li-1' }],
    });
    const tx = makeTx({ order: { create: jest.fn(), update: jest.fn() } });
    const { prisma } = makePrisma({
      order: { findUnique, findUniqueOrThrow },
      product: { findMany: jest.fn().mockResolvedValue([product()]) },
      tx,
    });
    const { products } = makeProducts();
    const { audit, record } = makeAudit();
    const service = new OrdersService(prisma, makeInventory(), products, audit);

    await service.update(seller, 'order-1', {
      items: [{ productId: 'prod-1', quantity: 2 }],
    });

    expect(tx.orderItem.deleteMany).toHaveBeenCalledWith({
      where: { orderId: 'order-1' },
    });
    const { data } = firstArg<OrderDataArgs>(tx.order.update);
    expect(data.subtotal).toEqual(new Prisma.Decimal(200));
    expect(data.totalAmount).toEqual(new Prisma.Decimal(180));

    const rows = orderUpdateAudits(record);
    expect(rows).toHaveLength(1);
    expect(rows[0].after).not.toHaveProperty('status');
  });

  it('surfaces insufficient_stock when a re-line exceeds availability', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: 'order-1',
      sellerId: 'seller-user-1',
      status: OrderStatus.PENDING,
      discountApprovedPercent: new Prisma.Decimal(0),
      items: [],
    });
    const { prisma } = makePrisma({
      order: { findUnique },
      product: { findMany: jest.fn().mockResolvedValue([product()]) },
    });
    const { products } = makeProducts(1);
    const { audit } = makeAudit();
    const service = new OrdersService(prisma, makeInventory(), products, audit);

    const error = await catchError(
      service.update(seller, 'order-1', {
        items: [{ productId: 'prod-1', quantity: 9 }],
      }),
    );
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({
      error: 'insufficient_stock',
    });
  });
});

describe('OrdersService.requestDiscount', () => {
  it('throws NotFoundException when the order does not exist', async () => {
    const { prisma } = makePrisma({
      order: { findUnique: jest.fn().mockResolvedValue(null) },
    });
    const { products } = makeProducts();
    const { audit } = makeAudit();
    const service = new OrdersService(prisma, makeInventory(), products, audit);

    await expect(
      service.requestDiscount(seller, 'order-1', { percent: 5 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('within the seller limit: approves immediately and returns the discriminated immediate result', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: 'order-1',
      sellerId: 'seller-user-1',
      subtotal: new Prisma.Decimal(1000),
      discountRequestedPercent: new Prisma.Decimal(0),
      discountApprovedPercent: new Prisma.Decimal(0),
      totalAmount: new Prisma.Decimal(1000),
    });
    const orderUpdate = jest.fn().mockResolvedValue({});
    const { prisma } = makePrisma({
      order: { findUnique, update: orderUpdate },
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ discountLimit: 10 }),
      },
    });
    const { products } = makeProducts();
    const { audit, record } = makeAudit();
    const service = new OrdersService(prisma, makeInventory(), products, audit);

    const result = await service.requestDiscount(seller, 'order-1', {
      percent: 5,
    });

    expect(orderUpdate).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: {
        discountRequestedPercent: new Prisma.Decimal(5),
        discountApprovedPercent: new Prisma.Decimal(5),
        totalAmount: new Prisma.Decimal(950),
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
    expect(result).toEqual({ kind: 'immediate', totalAmount: 950 });
  });

  it('over the seller limit: creates a PENDING request, notifies directors, and returns needs_approval', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: 'order-1',
      sellerId: 'seller-user-1',
      subtotal: new Prisma.Decimal(1000),
      discountRequestedPercent: new Prisma.Decimal(0),
      discountApprovedPercent: new Prisma.Decimal(0),
      totalAmount: new Prisma.Decimal(1000),
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
    const { products } = makeProducts();
    const { audit, record } = makeAudit();
    const service = new OrdersService(prisma, makeInventory(), products, audit);

    const result = await service.requestDiscount(seller, 'order-1', {
      percent: 20,
      reason: 'Loyal customer',
    });

    expect(tx.discountRequest.create).toHaveBeenCalledWith({
      data: {
        orderId: 'order-1',
        sellerId: 'seller-user-1',
        requestedPercent: new Prisma.Decimal(20),
        reason: 'Loyal customer',
      },
    });
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
    expect(result).toEqual({ kind: 'needs_approval', requestId: 'req-1' });
  });

  it('refuses a second concurrent pending request (pending_exists)', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: 'order-1',
      sellerId: 'seller-user-1',
      subtotal: new Prisma.Decimal(1000),
      discountRequestedPercent: new Prisma.Decimal(15),
      discountApprovedPercent: new Prisma.Decimal(0),
      totalAmount: new Prisma.Decimal(1000),
    });
    const { prisma, $transaction } = makePrisma({
      order: { findUnique },
      discountRequest: {
        findFirst: jest.fn().mockResolvedValue({ id: 'existing-req' }),
      },
    });
    const { products } = makeProducts();
    const { audit, record } = makeAudit();
    const service = new OrdersService(prisma, makeInventory(), products, audit);

    const error = await catchError(
      service.requestDiscount(seller, 'order-1', { percent: 20 }),
    );
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({
      error: 'pending_exists',
    });
    expect($transaction).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it('refuses a discount request on a COMPLETED order (locked), with no side effects', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: 'order-1',
      sellerId: 'seller-user-1',
      status: OrderStatus.COMPLETED,
      subtotal: new Prisma.Decimal(1000),
      discountRequestedPercent: new Prisma.Decimal(0),
      discountApprovedPercent: new Prisma.Decimal(0),
      totalAmount: new Prisma.Decimal(1000),
    });
    const orderUpdate = jest.fn();
    const { prisma, $transaction } = makePrisma({
      order: { findUnique, update: orderUpdate },
    });
    const { products } = makeProducts();
    const { audit, record } = makeAudit();
    const service = new OrdersService(prisma, makeInventory(), products, audit);

    const error = await catchError(
      service.requestDiscount(seller, 'order-1', { percent: 5 }),
    );
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({
      error: 'locked',
    });
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
      sellerId: 'seller-user-1',
      warehouseId: 'w1',
      items: [],
    });
    const txOrderUpdate = jest
      .fn()
      .mockResolvedValue({ id: 'order-1', status: OrderStatus.COMPLETED });
    const $transaction = jest.fn(
      async (cb: (tx: unknown) => Promise<unknown>) =>
        cb({ order: { update: txOrderUpdate } }),
    );
    const prisma = {
      order: { findUnique },
      $transaction,
    } as unknown as PrismaService;
    const { products } = makeProducts();
    const { audit, record } = makeAudit();
    const service = new OrdersService(prisma, makeInventory(), products, audit);

    await service.updateStatus(seller, 'order-1', OrderStatus.COMPLETED);

    expect(record).toHaveBeenCalledWith({
      userId: 'seller-user-1',
      action: AuditAction.UPDATE,
      entityType: 'Order',
      entityId: 'order-1',
      before: { status: OrderStatus.CONFIRMED },
      after: { status: OrderStatus.COMPLETED },
    });
  });
});
