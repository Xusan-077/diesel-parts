import { ProductsService } from './products.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../../generated/prisma/client';

function makePrisma(overrides: { product?: Record<string, unknown> } = {}) {
  return {
    product: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
      ...overrides.product,
    },
  } as unknown as PrismaService;
}

function makeAudit() {
  const record = jest.fn().mockResolvedValue(undefined);
  return { audit: { record } as unknown as AuditService, record };
}

const row = {
  id: 'p1',
  sku: 'DP-1',
  slug: 'dp-1',
  nameUz: 'Nasos',
  price: 100,
  minStock: 2,
  isActive: true,
};

const snapshot = {
  sku: 'DP-1',
  slug: 'dp-1',
  name: 'Nasos',
  price: 100,
  minStock: 2,
  isActive: true,
};

describe('ProductsService audit', () => {
  it('records a CREATE with an after snapshot', async () => {
    const create = jest.fn().mockResolvedValue(row);
    const prisma = makePrisma({
      product: { findUnique: jest.fn().mockResolvedValue(null), create },
    });
    const { audit, record } = makeAudit();
    const service = new ProductsService(prisma, audit);

    await service.create({ sku: 'DP-1' } as never, 'actor-1');

    expect(record).toHaveBeenCalledWith({
      userId: 'actor-1',
      action: AuditAction.CREATE,
      entityType: 'Product',
      entityId: 'p1',
      after: snapshot,
    });
  });

  it('records an UPDATE with before and after snapshots', async () => {
    const findUnique = jest.fn().mockResolvedValue(row);
    const update = jest.fn().mockResolvedValue({ ...row, price: 150 });
    const prisma = makePrisma({ product: { findUnique, update } });
    const { audit, record } = makeAudit();
    const service = new ProductsService(prisma, audit);

    await service.update('p1', { price: 150 }, 'actor-1');

    expect(record).toHaveBeenCalledWith({
      userId: 'actor-1',
      action: AuditAction.UPDATE,
      entityType: 'Product',
      entityId: 'p1',
      before: snapshot,
      after: { ...snapshot, price: 150 },
    });
  });

  it('records a DELETE when a product is retired', async () => {
    const findUnique = jest.fn().mockResolvedValue(row);
    const update = jest.fn().mockResolvedValue({ ...row, isActive: false });
    const prisma = makePrisma({ product: { findUnique, update } });
    const { audit, record } = makeAudit();
    const service = new ProductsService(prisma, audit);

    await service.remove('p1', 'actor-1');

    expect(record).toHaveBeenCalledWith({
      userId: 'actor-1',
      action: AuditAction.DELETE,
      entityType: 'Product',
      entityId: 'p1',
      before: snapshot,
      after: { ...snapshot, isActive: false },
    });
  });
});
