import { CustomersService } from './customers.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../../generated/prisma/client';

function makePrisma(overrides: { customer?: Record<string, unknown> } = {}) {
  return {
    customer: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn().mockResolvedValue({}),
      ...overrides.customer,
    },
  } as unknown as PrismaService;
}

function makeAudit() {
  const record = jest.fn().mockResolvedValue(undefined);
  return { audit: { record } as unknown as AuditService, record };
}

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
  };

  it('records a CREATE with an after snapshot', async () => {
    const create = jest.fn().mockResolvedValue(row);
    const prisma = makePrisma({ customer: { create } });
    const { audit, record } = makeAudit();
    const service = new CustomersService(prisma, audit);

    await service.create({ name: 'Aziz', phone: '998901234567' }, 'actor-1');

    expect(record).toHaveBeenCalledWith({
      userId: 'actor-1',
      action: AuditAction.CREATE,
      entityType: 'Customer',
      entityId: 'cus-1',
      after: { name: 'Aziz', phone: '998901234567', telegram: null },
    });
  });

  it('records an UPDATE with before and after snapshots', async () => {
    const findUnique = jest.fn().mockResolvedValue(row);
    const update = jest
      .fn()
      .mockResolvedValue({ ...row, name: 'Aziz Karimov' });
    const prisma = makePrisma({ customer: { findUnique, update } });
    const { audit, record } = makeAudit();
    const service = new CustomersService(prisma, audit);

    await service.update('cus-1', { name: 'Aziz Karimov' }, 'actor-1');

    expect(record).toHaveBeenCalledWith({
      userId: 'actor-1',
      action: AuditAction.UPDATE,
      entityType: 'Customer',
      entityId: 'cus-1',
      before: { name: 'Aziz', phone: '998901234567', telegram: null },
      after: { name: 'Aziz Karimov', phone: '998901234567', telegram: null },
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
