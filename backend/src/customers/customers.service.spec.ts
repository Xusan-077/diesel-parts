import { ConflictException, NotFoundException } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction, Role } from '../../generated/prisma/client';
import type { ScopeActor } from '../common/scope';

function makePrisma(
  overrides: {
    customer?: Record<string, unknown>;
    order?: Record<string, unknown>;
  } = {},
) {
  return {
    customer: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      delete: jest.fn().mockResolvedValue({}),
      ...overrides.customer,
    },
    order: {
      groupBy: jest.fn().mockResolvedValue([]),
      ...overrides.order,
    },
    $transaction: jest.fn(async (queries: Array<Promise<unknown>>) =>
      Promise.all(queries),
    ),
  } as unknown as PrismaService;
}

function makeAudit() {
  const record = jest.fn().mockResolvedValue(undefined);
  return { audit: { record } as unknown as AuditService, record };
}

const seller: ScopeActor = { id: 'seller-1', role: Role.SELLER };
const director: ScopeActor = { id: 'director-1', role: Role.DIRECTOR };

describe('CustomersService.findOrCreateByPhone', () => {
  it('creates a new customer with every detail given', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'cus-1',
      phone: '998901234567',
      name: 'Aziz Karimov',
    });
    const prisma = makePrisma({
      customer: { findMany: jest.fn().mockResolvedValue([]), create },
    });
    const service = new CustomersService(prisma, makeAudit().audit);

    const result = await service.findOrCreateByPhone('998901234567', {
      name: 'Aziz Karimov',
      email: 'aziz@example.com',
      company: 'Aziz LLC',
      taxId: '123456789',
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        phone: '998901234567',
        name: 'Aziz Karimov',
        email: 'aziz@example.com',
        company: 'Aziz LLC',
        taxId: '123456789',
      },
    });
    expect(result).toEqual({
      id: 'cus-1',
      phone: '998901234567',
      name: 'Aziz Karimov',
    });
  });

  it('defaults the name to "Checkout" when none is given for a new customer', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'cus-2' });
    const prisma = makePrisma({
      customer: { findMany: jest.fn().mockResolvedValue([]), create },
    });
    const service = new CustomersService(prisma, makeAudit().audit);

    await service.findOrCreateByPhone('998901234567');

    expect(create).toHaveBeenCalledWith({
      data: {
        phone: '998901234567',
        name: 'Checkout',
        email: undefined,
        company: undefined,
        taxId: undefined,
      },
    });
  });

  it('reuses an existing customer matched on canonical digits, and touches nothing when nothing changed', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'cus-1',
        phone: '+998 90 123-45-67',
        name: 'Existing',
        email: 'e@x.com',
        company: 'X',
        taxId: '1',
      },
    ]);
    const update = jest.fn();
    const prisma = makePrisma({ customer: { findMany, update } });
    const service = new CustomersService(prisma, makeAudit().audit);

    const result = await service.findOrCreateByPhone('998901234567', {
      name: 'Existing',
      email: 'e@x.com',
      company: 'X',
      taxId: '1',
    });

    expect(update).not.toHaveBeenCalled();
    expect(result.id).toBe('cus-1');
  });

  it('overwrites the name on an existing customer when it differs', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'cus-1',
        phone: '998901234567',
        name: 'Checkout',
        email: null,
        company: null,
        taxId: null,
      },
    ]);
    const update = jest
      .fn()
      .mockResolvedValue({ id: 'cus-1', name: 'Aziz Karimov' });
    const prisma = makePrisma({ customer: { findMany, update } });
    const service = new CustomersService(prisma, makeAudit().audit);

    await service.findOrCreateByPhone('998901234567', { name: 'Aziz Karimov' });

    expect(update).toHaveBeenCalledWith({
      where: { id: 'cus-1' },
      data: { name: 'Aziz Karimov' },
    });
  });

  it('backfills email/company/taxId only when the existing column is null', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'cus-1',
        phone: '998901234567',
        name: 'Aziz',
        email: null,
        company: 'Old LLC',
        taxId: null,
      },
    ]);
    const update = jest.fn().mockResolvedValue({ id: 'cus-1' });
    const prisma = makePrisma({ customer: { findMany, update } });
    const service = new CustomersService(prisma, makeAudit().audit);

    await service.findOrCreateByPhone('998901234567', {
      name: 'Aziz',
      email: 'aziz@example.com',
      company: 'New LLC',
      taxId: '999',
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: 'cus-1' },
      data: { email: 'aziz@example.com', taxId: '999' },
    });
  });
});

describe('CustomersService audit', () => {
  const row = {
    id: 'cus-1',
    name: 'Aziz',
    phone: '998901234567',
    telegram: null,
    _count: { orders: 0 },
  };

  it('records a CREATE with an after snapshot of name/phone/assignedSellerId', async () => {
    const create = jest
      .fn()
      .mockResolvedValue({ ...row, assignedSellerId: null });
    const prisma = makePrisma({ customer: { create } });
    const { audit, record } = makeAudit();
    const service = new CustomersService(prisma, audit);

    await service.create({ name: 'Aziz', phone: '998901234567' }, 'actor-1');

    expect(record).toHaveBeenCalledWith({
      userId: 'actor-1',
      action: AuditAction.CREATE,
      entityType: 'Customer',
      entityId: 'cus-1',
      after: {
        name: 'Aziz',
        phone: '998901234567',
        assignedSellerId: null,
      },
    });
  });

  it('records an UPDATE with before/after diffed on name/phone/email/company/notes', async () => {
    const before = {
      ...row,
      email: null,
      company: null,
      notes: null,
    };
    const findUnique = jest.fn().mockResolvedValue(before);
    const update = jest
      .fn()
      .mockResolvedValue({ ...before, name: 'Aziz Karimov' });
    const prisma = makePrisma({ customer: { findUnique, update } });
    const { audit, record } = makeAudit();
    const service = new CustomersService(prisma, audit);

    await service.update('cus-1', { name: 'Aziz Karimov' }, 'actor-1');

    expect(record).toHaveBeenCalledWith({
      userId: 'actor-1',
      action: AuditAction.UPDATE,
      entityType: 'Customer',
      entityId: 'cus-1',
      before: { name: 'Aziz' },
      after: { name: 'Aziz Karimov' },
    });
  });

  it('records a DELETE with a before snapshot', async () => {
    const findUnique = jest.fn().mockResolvedValue(row);
    const prisma = makePrisma({ customer: { findUnique } });
    const { audit, record } = makeAudit();
    const service = new CustomersService(prisma, audit);

    await service.remove('cus-1', 'actor-1');

    expect(record).toHaveBeenCalledWith({
      userId: 'actor-1',
      action: AuditAction.DELETE,
      entityType: 'Customer',
      entityId: 'cus-1',
      before: { name: 'Aziz', phone: '998901234567', telegram: null },
    });
  });
});

describe('CustomersService.findAll', () => {
  it('stays unscoped when no actor is given', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const prisma = makePrisma({ customer: { findMany, count } });
    const service = new CustomersService(prisma, makeAudit().audit);

    await service.findAll({ page: 1, limit: 20 });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { AND: [{}, {}] } }),
    );
  });

  it('applies customerReadScope when an actor is given', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const prisma = makePrisma({ customer: { findMany, count } });
    const service = new CustomersService(prisma, makeAudit().audit);

    await service.findAll({ page: 1, limit: 20 }, seller);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { AND: [{ assignedSellerId: seller.id }, {}] },
      }),
    );
  });

  it('includes the pool when the query asks for it', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const prisma = makePrisma({ customer: { findMany, count } });
    const service = new CustomersService(prisma, makeAudit().audit);

    await service.findAll({ page: 1, limit: 20, pool: 'true' }, seller);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            {
              OR: [{ assignedSellerId: seller.id }, { assignedSellerId: null }],
            },
            {},
          ],
        },
      }),
    );
  });

  it('attaches orderCount and totalSpent to every row', async () => {
    const findMany = jest.fn().mockResolvedValue([
      { id: 'cus-1', name: 'Aziz', _count: { orders: 3 } },
      { id: 'cus-2', name: 'Vali', _count: { orders: 0 } },
    ]);
    const count = jest.fn().mockResolvedValue(2);
    const groupBy = jest
      .fn()
      .mockResolvedValue([{ customerId: 'cus-1', _sum: { total: 1500 } }]);
    const prisma = makePrisma({
      customer: { findMany, count },
      order: { groupBy },
    });
    const service = new CustomersService(prisma, makeAudit().audit);

    const result = await service.findAll({ page: 1, limit: 20 });

    expect(result.data).toEqual([
      {
        id: 'cus-1',
        name: 'Aziz',
        assignedSellerName: null,
        orderCount: 3,
        totalSpent: 1500,
      },
      {
        id: 'cus-2',
        name: 'Vali',
        assignedSellerName: null,
        orderCount: 0,
        totalSpent: 0,
      },
    ]);
    expect(groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { customerId: { in: ['cus-1', 'cus-2'] }, status: 'COMPLETED' },
      }),
    );
  });
});

describe('CustomersService.findAll — search', () => {
  it('searches company in addition to name and phone', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const prisma = makePrisma({ customer: { findMany, count } });
    const service = new CustomersService(prisma, makeAudit().audit);

    await service.findAll({ page: 1, limit: 20, search: 'Acme' });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            {},
            {
              OR: [
                { name: { contains: 'Acme', mode: 'insensitive' } },
                { phone: { contains: 'Acme', mode: 'insensitive' } },
                { company: { contains: 'Acme', mode: 'insensitive' } },
              ],
            },
          ],
        },
      }),
    );
  });
});

describe('CustomersService.create — normalization', () => {
  it('trims name and phone before writing', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'cus-1',
      name: 'Aziz',
      phone: '998901234567',
      assignedSellerId: null,
    });
    const prisma = makePrisma({ customer: { create } });
    const service = new CustomersService(prisma, makeAudit().audit);

    await service.create(
      { name: '  Aziz  ', phone: ' 998901234567 ' },
      'actor-1',
    );

    expect(create).toHaveBeenCalledWith({
      data: {
        name: 'Aziz',
        phone: '998901234567',
        assignedSellerId: null,
      },
    });
  });

  it('normalizes empty optional fields to null', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'cus-1',
      name: 'Aziz',
      phone: '1',
      company: null,
      assignedSellerId: null,
    });
    const prisma = makePrisma({ customer: { create } });
    const service = new CustomersService(prisma, makeAudit().audit);

    await service.create(
      { name: 'Aziz', phone: '1', company: '  ', email: '', notes: '' },
      'actor-1',
    );

    expect(create).toHaveBeenCalledWith({
      data: {
        name: 'Aziz',
        phone: '1',
        company: null,
        email: null,
        notes: null,
        assignedSellerId: null,
      },
    });
  });
});

describe('CustomersService.update — normalization', () => {
  it('trims a present required field', async () => {
    const before = {
      id: 'cus-1',
      name: 'Aziz',
      phone: '1',
      email: null,
      company: null,
      notes: null,
    };
    const findFirst = jest.fn().mockResolvedValue(before);
    const update = jest
      .fn()
      .mockResolvedValue({ ...before, name: 'Aziz Karimov' });
    const prisma = makePrisma({ customer: { findFirst, update } });
    const service = new CustomersService(prisma, makeAudit().audit);

    await service.update(
      'cus-1',
      { name: '  Aziz Karimov  ' },
      seller.id,
      seller,
    );

    expect(update).toHaveBeenCalledWith({
      where: { id: 'cus-1' },
      data: { name: 'Aziz Karimov' },
    });
  });

  it('normalizes an empty optional field to null when present in the partial DTO', async () => {
    const before = {
      id: 'cus-1',
      name: 'Aziz',
      phone: '1',
      email: 'a@x.com',
      company: 'Old LLC',
      notes: 'note',
    };
    const findFirst = jest.fn().mockResolvedValue(before);
    const update = jest.fn().mockResolvedValue({ ...before, company: null });
    const prisma = makePrisma({ customer: { findFirst, update } });
    const service = new CustomersService(prisma, makeAudit().audit);

    await service.update('cus-1', { company: '   ' }, seller.id, seller);

    expect(update).toHaveBeenCalledWith({
      where: { id: 'cus-1' },
      data: { company: null },
    });
  });

  it('leaves fields omitted from the partial DTO untouched (not forced to null)', async () => {
    const before = {
      id: 'cus-1',
      name: 'Aziz',
      phone: '1',
      email: 'a@x.com',
      company: 'Old LLC',
      notes: 'note',
    };
    const findFirst = jest.fn().mockResolvedValue(before);
    const update = jest.fn().mockResolvedValue(before);
    const prisma = makePrisma({ customer: { findFirst, update } });
    const service = new CustomersService(prisma, makeAudit().audit);

    await service.update('cus-1', { name: 'Aziz' }, seller.id, seller);

    expect(update).toHaveBeenCalledWith({
      where: { id: 'cus-1' },
      data: { name: 'Aziz' },
    });
  });
});

describe('CustomersService.findOne', () => {
  it('uses findUnique (unscoped) when no actor is given', async () => {
    const findUnique = jest
      .fn()
      .mockResolvedValue({ id: 'cus-1', name: 'Aziz', _count: { orders: 0 } });
    const prisma = makePrisma({ customer: { findUnique } });
    const service = new CustomersService(prisma, makeAudit().audit);

    const result = await service.findOne('cus-1');

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'cus-1' } }),
    );
    expect(result).toMatchObject({ orderCount: 0, totalSpent: 0 });
  });

  it('reads through customerReadScope with the pool included when an actor is given', async () => {
    const findFirst = jest
      .fn()
      .mockResolvedValue({ id: 'cus-1', name: 'Aziz', _count: { orders: 0 } });
    const prisma = makePrisma({ customer: { findFirst } });
    const service = new CustomersService(prisma, makeAudit().audit);

    await service.findOne('cus-1', seller);

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'cus-1',
          OR: [{ assignedSellerId: seller.id }, { assignedSellerId: null }],
        },
      }),
    );
  });

  it('throws NotFoundException when missing', async () => {
    const prisma = makePrisma();
    const service = new CustomersService(prisma, makeAudit().audit);

    await expect(service.findOne('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('attaches orderCount/totalSpent', async () => {
    const findUnique = jest
      .fn()
      .mockResolvedValue({ id: 'cus-1', name: 'Aziz', _count: { orders: 2 } });
    const groupBy = jest
      .fn()
      .mockResolvedValue([{ customerId: 'cus-1', _sum: { total: 500 } }]);
    const prisma = makePrisma({
      customer: { findUnique },
      order: { groupBy },
    });
    const service = new CustomersService(prisma, makeAudit().audit);

    const result = await service.findOne('cus-1');

    expect(result).toEqual({
      id: 'cus-1',
      name: 'Aziz',
      assignedSellerName: null,
      orderCount: 2,
      totalSpent: 500,
    });
  });
});

describe('CustomersService.create — assignedSellerId', () => {
  it('assigns the row to a seller actor', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'cus-1',
      name: 'Aziz',
      phone: '1',
      assignedSellerId: seller.id,
    });
    const prisma = makePrisma({ customer: { create } });
    const service = new CustomersService(prisma, makeAudit().audit);

    await service.create({ name: 'Aziz', phone: '1' }, seller.id, seller);

    expect(create).toHaveBeenCalledWith({
      data: { name: 'Aziz', phone: '1', assignedSellerId: seller.id },
    });
  });

  it('leaves the row unassigned (pooled) for a director actor', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'cus-1',
      name: 'Aziz',
      phone: '1',
      assignedSellerId: null,
    });
    const prisma = makePrisma({ customer: { create } });
    const service = new CustomersService(prisma, makeAudit().audit);

    await service.create({ name: 'Aziz', phone: '1' }, director.id, director);

    expect(create).toHaveBeenCalledWith({
      data: { name: 'Aziz', phone: '1', assignedSellerId: null },
    });
  });

  it('defaults assignedSellerId to null when no actor is given', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'cus-1',
      name: 'Aziz',
      phone: '1',
      assignedSellerId: null,
    });
    const prisma = makePrisma({ customer: { create } });
    const service = new CustomersService(prisma, makeAudit().audit);

    await service.create({ name: 'Aziz', phone: '1' }, 'actor-1');

    expect(create).toHaveBeenCalledWith({
      data: { name: 'Aziz', phone: '1', assignedSellerId: null },
    });
  });
});

describe('CustomersService.update — audit skip/record', () => {
  it('skips the audit write when nothing actually changed', async () => {
    const before = {
      id: 'cus-1',
      name: 'Aziz',
      phone: '1',
      email: null,
      company: null,
      notes: null,
    };
    const findFirst = jest.fn().mockResolvedValue(before);
    const update = jest.fn().mockResolvedValue(before);
    const prisma = makePrisma({ customer: { findFirst, update } });
    const { audit, record } = makeAudit();
    const service = new CustomersService(prisma, audit);

    const result = await service.update(
      'cus-1',
      { name: 'Aziz' },
      seller.id,
      seller,
    );

    expect(result).toEqual(before);
    expect(record).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the row is outside the actor write scope', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const prisma = makePrisma({ customer: { findFirst } });
    const service = new CustomersService(prisma, makeAudit().audit);

    await expect(
      service.update('cus-1', { name: 'Aziz' }, seller.id, seller),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('CustomersService.claim', () => {
  it('claims an unclaimed row and records the audit entry', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = makePrisma({ customer: { updateMany } });
    const { audit, record } = makeAudit();
    const service = new CustomersService(prisma, audit);

    const result = await service.claim('cus-1', seller);

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'cus-1', assignedSellerId: null },
      data: { assignedSellerId: seller.id },
    });
    expect(result).toEqual({ id: 'cus-1' });
    expect(record).toHaveBeenCalledWith({
      userId: seller.id,
      action: AuditAction.UPDATE,
      entityType: 'Customer',
      entityId: 'cus-1',
      before: { assignedSellerId: null },
      after: { assignedSellerId: seller.id },
    });
  });

  it('throws NotFoundException when the row does not exist at all', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const findUnique = jest.fn().mockResolvedValue(null);
    const prisma = makePrisma({ customer: { updateMany, findUnique } });
    const { audit, record } = makeAudit();
    const service = new CustomersService(prisma, audit);

    await expect(service.claim('missing', seller)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(record).not.toHaveBeenCalled();
  });

  it('throws ConflictException when the row exists but is already claimed', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const findUnique = jest.fn().mockResolvedValue({ id: 'cus-1' });
    const prisma = makePrisma({ customer: { updateMany, findUnique } });
    const { audit, record } = makeAudit();
    const service = new CustomersService(prisma, audit);

    await expect(service.claim('cus-1', seller)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(record).not.toHaveBeenCalled();
  });
});

describe('CustomersService.findByPhone', () => {
  it('matches on canonical digits and scopes without the pool', async () => {
    const findMany = jest.fn().mockResolvedValue([
      { id: 'cus-1', name: 'Aziz', phone: '+998 90 123-45-67' },
      { id: 'cus-2', name: 'Vali', phone: '998907654321' },
    ]);
    const prisma = makePrisma({ customer: { findMany } });
    const service = new CustomersService(prisma, makeAudit().audit);

    const result = await service.findByPhone(['998901234567'], seller);

    expect(findMany).toHaveBeenCalledWith({
      where: {
        AND: [
          { assignedSellerId: seller.id },
          { OR: [{ phone: { contains: '67' } }] },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: 1000,
      select: { id: true, name: true, phone: true },
    });
    expect(result).toEqual([{ phone: '901234567', id: 'cus-1', name: 'Aziz' }]);
  });

  it('returns an empty array without querying when no valid phone is given', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = makePrisma({ customer: { findMany } });
    const service = new CustomersService(prisma, makeAudit().audit);

    const result = await service.findByPhone(['123'], seller);

    expect(result).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });
});
