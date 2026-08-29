import { NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../../generated/prisma/client';

function makePrisma(overrides: { product?: Record<string, unknown> } = {}) {
  return {
    product: {
      findMany: jest.fn().mockResolvedValue([]),
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

function makePublicProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    sku: 'SKU-1',
    slug: 'sku-1',
    nameUz: 'X',
    nameRu: 'X',
    nameEn: 'X',
    price: 100,
    purchasePrice: 60,
    minStock: 5,
    isActive: true,
    inventories: [{ quantity: 10, reservedQuantity: 0, warehouseId: 'w1' }],
    category: { id: 'c1', nameEn: 'Cat' },
    brand: null,
    ...overrides,
  };
}

describe('ProductsService public reads', () => {
  const { audit } = makeAudit();

  describe('findAllPublic', () => {
    it('forces isActive: true on the query', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const service = new ProductsService(
        makePrisma({ product: { findMany } }),
        audit,
      );

      await service.findAllPublic({});

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
      );
    });

    it('never includes purchasePrice in the returned rows', async () => {
      const findMany = jest.fn().mockResolvedValue([makePublicProduct()]);
      const service = new ProductsService(
        makePrisma({ product: { findMany } }),
        audit,
      );

      const result = await service.findAllPublic({});

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).not.toHaveProperty('purchasePrice');
    });
  });

  describe('findOnePublic', () => {
    it('looks up by slug, not id', async () => {
      const findUnique = jest.fn().mockResolvedValue(makePublicProduct());
      const service = new ProductsService(
        makePrisma({ product: { findUnique } }),
        audit,
      );

      await service.findOnePublic('sku-1');

      expect(findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { slug: 'sku-1' } }),
      );
    });

    it('404s when the product is inactive', async () => {
      const findUnique = jest
        .fn()
        .mockResolvedValue(makePublicProduct({ isActive: false }));
      const service = new ProductsService(
        makePrisma({ product: { findUnique } }),
        audit,
      );

      await expect(service.findOnePublic('sku-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('404s when the product does not exist', async () => {
      const findUnique = jest.fn().mockResolvedValue(null);
      const service = new ProductsService(
        makePrisma({ product: { findUnique } }),
        audit,
      );

      await expect(service.findOnePublic('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('never includes purchasePrice', async () => {
      const findUnique = jest.fn().mockResolvedValue(makePublicProduct());
      const service = new ProductsService(
        makePrisma({ product: { findUnique } }),
        audit,
      );

      const result = await service.findOnePublic('sku-1');

      expect(result).not.toHaveProperty('purchasePrice');
    });
  });
});
