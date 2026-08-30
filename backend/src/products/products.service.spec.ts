import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction, Prisma } from '../../generated/prisma/client';
import { toCsv, type ProductCsvRow } from './product-csv';

function makePrisma(
  overrides: {
    product?: Record<string, unknown>;
    warehouse?: Record<string, unknown>;
    inventory?: Record<string, unknown>;
    review?: Record<string, unknown>;
    orderItem?: Record<string, unknown>;
  } = {},
) {
  return {
    product: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
      ...overrides.product,
    },
    warehouse: {
      findFirst: jest.fn().mockResolvedValue({ id: 'wh-catalog' }),
      create: jest.fn().mockResolvedValue({ id: 'wh-catalog' }),
      ...overrides.warehouse,
    },
    inventory: {
      upsert: jest.fn().mockResolvedValue(undefined),
      ...overrides.inventory,
    },
    review: {
      groupBy: jest.fn().mockResolvedValue([]),
      ...overrides.review,
    },
    orderItem: {
      groupBy: jest.fn().mockResolvedValue([]),
      ...overrides.orderItem,
    },
  } as unknown as PrismaService;
}

function csvRow(overrides: Partial<ProductCsvRow> = {}): ProductCsvRow {
  return {
    sku: 'DP-1',
    slug: 'dp-1',
    oemNumbers: ['OEM-1'],
    nameUz: 'Nasos',
    nameRu: 'Насос',
    nameEn: 'Pump',
    descriptionUz: '',
    descriptionRu: '',
    descriptionEn: '',
    price: 100,
    stock: 7,
    minStock: 2,
    categoryId: 'cat-1',
    brandId: 'brand-1',
    compatibleModels: [],
    isActive: true,
    ...overrides,
  };
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

describe('ProductsService stock on create/update', () => {
  it('writes stock onto the catalog warehouse, not the Product row, on create', async () => {
    const create = jest.fn().mockResolvedValue(row);
    const upsert = jest.fn().mockResolvedValue(undefined);
    const prisma = makePrisma({
      product: { findUnique: jest.fn().mockResolvedValue(null), create },
      inventory: { upsert },
    });
    const service = new ProductsService(prisma, makeAudit().audit);

    await service.create({ sku: 'DP-1', stock: 9 } as never, 'actor-1');

    expect(create).toHaveBeenCalledWith({ data: { sku: 'DP-1' } });
    expect(upsert).toHaveBeenCalledWith({
      where: {
        productId_warehouseId: { productId: 'p1', warehouseId: 'wh-catalog' },
      },
      create: {
        productId: 'p1',
        warehouseId: 'wh-catalog',
        quantity: 9,
        reservedQuantity: 0,
      },
      update: { quantity: 9 },
    });
  });

  it('does not touch Inventory on create when stock is omitted', async () => {
    const create = jest.fn().mockResolvedValue(row);
    const upsert = jest.fn();
    const findFirst = jest.fn();
    const prisma = makePrisma({
      product: { findUnique: jest.fn().mockResolvedValue(null), create },
      inventory: { upsert },
      warehouse: { findFirst },
    });
    const service = new ProductsService(prisma, makeAudit().audit);

    await service.create({ sku: 'DP-1' } as never, 'actor-1');

    expect(upsert).not.toHaveBeenCalled();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('writes stock onto the catalog warehouse on update', async () => {
    const findUnique = jest.fn().mockResolvedValue(row);
    const update = jest.fn().mockResolvedValue(row);
    const upsert = jest.fn().mockResolvedValue(undefined);
    const prisma = makePrisma({
      product: { findUnique, update },
      inventory: { upsert },
    });
    const service = new ProductsService(prisma, makeAudit().audit);

    await service.update('p1', { stock: 4 }, 'actor-1');

    expect(update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: {} });
    expect(upsert).toHaveBeenCalledWith({
      where: {
        productId_warehouseId: { productId: 'p1', warehouseId: 'wh-catalog' },
      },
      create: {
        productId: 'p1',
        warehouseId: 'wh-catalog',
        quantity: 4,
        reservedQuantity: 0,
      },
      update: { quantity: 4 },
    });
  });
});

describe('ProductsService create/update error translation', () => {
  it('reports a slug collision on create -- the proactive check only covers sku', async () => {
    const create = jest.fn().mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['slug'] },
      }),
    );
    const service = new ProductsService(
      makePrisma({
        product: { findUnique: jest.fn().mockResolvedValue(null), create },
      }),
      makeAudit().audit,
    );

    await expect(
      service.create({ sku: 'DP-1', slug: 'taken' } as never, 'actor-1'),
    ).rejects.toMatchObject({
      response: { statusCode: 409, message: 'slug already exists' },
    });
  });

  it('reports a missing category/brand as a 400 on create', async () => {
    const create = jest.fn().mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('FK violation', {
        code: 'P2003',
        clientVersion: 'test',
      }),
    );
    const service = new ProductsService(
      makePrisma({
        product: { findUnique: jest.fn().mockResolvedValue(null), create },
      }),
      makeAudit().audit,
    );

    await expect(
      service.create({ sku: 'DP-1' } as never, 'actor-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reports a missing category/brand as a 400 on update', async () => {
    const findUnique = jest.fn().mockResolvedValue(row);
    const update = jest.fn().mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('FK violation', {
        code: 'P2003',
        clientVersion: 'test',
      }),
    );
    const service = new ProductsService(
      makePrisma({ product: { findUnique, update } }),
      makeAudit().audit,
    );

    await expect(
      service.update('p1', { categoryId: 'missing' }, 'actor-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
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

  describe('findAllPublic with ids', () => {
    it('filters to the given id list, for a batch lookup', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const service = new ProductsService(
        makePrisma({ product: { findMany } }),
        audit,
      );

      await service.findAllPublic({ ids: 'p1,p2' });

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true, id: { in: ['p1', 'p2'] } },
        }),
      );
    });
  });

  describe('findAllPublic with sort', () => {
    it('orders by id when sort=id, instead of the newest-first default', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const service = new ProductsService(
        makePrisma({ product: { findMany } }),
        audit,
      );

      await service.findAllPublic({ sort: 'id' });

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { id: 'asc' } }),
      );
    });

    it('sorts by computed available stock, ascending, when sort=stock', async () => {
      const findMany = jest.fn().mockResolvedValue([
        makePublicProduct({
          id: 'high',
          inventories: [
            { quantity: 9, reservedQuantity: 0, warehouseId: 'w1' },
          ],
        }),
        makePublicProduct({
          id: 'low',
          inventories: [
            { quantity: 2, reservedQuantity: 0, warehouseId: 'w1' },
          ],
        }),
      ]);
      const service = new ProductsService(
        makePrisma({ product: { findMany } }),
        audit,
      );

      const result = await service.findAllPublic({ sort: 'stock' });

      expect(result.data.map((p) => p.id)).toEqual(['low', 'high']);
    });

    it('orders by the given locale name column when sort=name-asc', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const service = new ProductsService(
        makePrisma({ product: { findMany } }),
        audit,
      );

      await service.findAllPublic({ sort: 'name-asc', lang: 'ru' });

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { nameRu: 'asc' } }),
      );
    });

    it('orders by the given locale name column, descending, when sort=name-desc', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const service = new ProductsService(
        makePrisma({ product: { findMany } }),
        audit,
      );

      await service.findAllPublic({ sort: 'name-desc', lang: 'en' });

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { nameEn: 'desc' } }),
      );
    });
  });

  describe('findAllPublic with brandIds/categoryIds', () => {
    it('filters by brandIds, winning over a single brandId', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const service = new ProductsService(
        makePrisma({ product: { findMany } }),
        audit,
      );

      await service.findAllPublic({ brandIds: 'b1,b2', brandId: 'ignored' });

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true, brandId: { in: ['b1', 'b2'] } },
        }),
      );
    });

    it('applies no brand filter at all for an empty brandIds -- unlike categoryIds, there is no single value to fall back to', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const service = new ProductsService(
        makePrisma({ product: { findMany } }),
        audit,
      );

      await service.findAllPublic({ brandIds: '', brandId: 'ignored' });

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
      );
    });

    it('falls back to the single brandId when brandIds is entirely absent', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const service = new ProductsService(
        makePrisma({ product: { findMany } }),
        audit,
      );

      await service.findAllPublic({ brandId: 'b1' });

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true, brandId: 'b1' },
        }),
      );
    });

    it('treats an empty categoryIds as a real scope matching nothing', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const service = new ProductsService(
        makePrisma({ product: { findMany } }),
        audit,
      );

      await service.findAllPublic({ categoryIds: '' });

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true, categoryId: { in: [] } },
        }),
      );
    });

    it('falls back to the single categoryId when categoryIds is absent', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const service = new ProductsService(
        makePrisma({ product: { findMany } }),
        audit,
      );

      await service.findAllPublic({ categoryId: 'c1' });

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true, categoryId: 'c1' },
        }),
      );
    });
  });

  describe('findAllPublic with a price range', () => {
    it('excludes unpriced products once either bound is set', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const service = new ProductsService(
        makePrisma({ product: { findMany } }),
        audit,
      );

      await service.findAllPublic({ priceMin: 100, priceMax: 500 });

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true, price: { gte: 100, lte: 500 } },
        }),
      );
    });
  });

  describe('findAllPublic with a locale-scoped search', () => {
    it('matches only the given locale name column, sku, and uppercased oem numbers', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const service = new ProductsService(
        makePrisma({ product: { findMany } }),
        audit,
      );

      await service.findAllPublic({ search: 'voe14514151', lang: 'uz' });

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isActive: true,
            OR: [
              { nameUz: { contains: 'voe14514151', mode: 'insensitive' } },
              { sku: { contains: 'voe14514151', mode: 'insensitive' } },
              { oemNumbers: { has: 'VOE14514151' } },
            ],
          },
        }),
      );
    });

    it('falls back to matching every locale column when lang is omitted', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const service = new ProductsService(
        makePrisma({ product: { findMany } }),
        audit,
      );

      await service.findAllAdmin({ search: 'pump' });

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { nameUz: { contains: 'pump', mode: 'insensitive' } },
              { nameRu: { contains: 'pump', mode: 'insensitive' } },
              { nameEn: { contains: 'pump', mode: 'insensitive' } },
              { sku: { contains: 'pump', mode: 'insensitive' } },
            ],
          },
        }),
      );
    });
  });
});

describe('ProductsService.findActiveSlugs', () => {
  it('returns only active product slugs', async () => {
    const findMany = jest
      .fn()
      .mockResolvedValue([{ slug: 'a' }, { slug: 'b' }]);
    const service = new ProductsService(
      makePrisma({ product: { findMany } }),
      makeAudit().audit,
    );

    const result = await service.findActiveSlugs();

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } }),
    );
    expect(result).toEqual(['a', 'b']);
  });
});

describe('ProductsService.productStats', () => {
  it('returns empty stats for every id when there is nothing to aggregate', async () => {
    const service = new ProductsService(makePrisma(), makeAudit().audit);

    const result = await service.productStats(['p1', 'p2']);

    expect(result).toEqual([
      { productId: 'p1', rating: null, reviewCount: 0, soldCount: 0 },
      { productId: 'p2', rating: null, reviewCount: 0, soldCount: 0 },
    ]);
  });

  it('rounds the average rating to one decimal and reports units sold from completed orders', async () => {
    const groupByReview = jest
      .fn()
      .mockResolvedValue([
        { productId: 'p1', _avg: { rating: 4.333 }, _count: { _all: 3 } },
      ]);
    const groupByOrderItem = jest
      .fn()
      .mockResolvedValue([{ productId: 'p1', _sum: { quantity: 12 } }]);
    const service = new ProductsService(
      makePrisma({
        review: { groupBy: groupByReview },
        orderItem: { groupBy: groupByOrderItem },
      }),
      makeAudit().audit,
    );

    const result = await service.productStats(['p1']);

    expect(result).toEqual([
      { productId: 'p1', rating: 4.3, reviewCount: 3, soldCount: 12 },
    ]);
    expect(groupByReview).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { productId: { in: ['p1'] }, isApproved: true },
      }),
    );
    expect(groupByOrderItem).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { productId: { in: ['p1'] }, order: { status: 'COMPLETED' } },
      }),
    );
  });

  it('returns an empty array for an empty id list, without querying', async () => {
    const groupByReview = jest.fn();
    const service = new ProductsService(
      makePrisma({ review: { groupBy: groupByReview } }),
      makeAudit().audit,
    );

    expect(await service.productStats([])).toEqual([]);
    expect(groupByReview).not.toHaveBeenCalled();
  });
});

describe('ProductsService.importCsv', () => {
  it('passes a structural error through untouched', async () => {
    const service = new ProductsService(makePrisma(), makeAudit().audit);

    const result = await service.importCsv('', 'actor-1');

    expect(result.success).toBe(false);
    expect(result.errors[0].message).toContain("bo'sh");
  });

  it('reports a bad row by line number and writes nothing', async () => {
    const create = jest.fn();
    const service = new ProductsService(
      makePrisma({ product: { create } }),
      makeAudit().audit,
    );

    const result = await service.importCsv(
      toCsv([csvRow(), csvRow({ sku: 'DP-2', slug: 'Not A Slug' })]),
      'actor-1',
    );

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].line).toBe(3);
    expect(result.errors[0].message).toContain('slug');
    expect(create).not.toHaveBeenCalled();
  });

  it('creates a new row and writes its stock to the catalog warehouse', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'p-new' });
    const upsert = jest.fn().mockResolvedValue(undefined);
    const service = new ProductsService(
      makePrisma({
        product: { findUnique: jest.fn().mockResolvedValue(null), create },
        inventory: { upsert },
      }),
      makeAudit().audit,
    );

    const result = await service.importCsv(
      toCsv([csvRow({ stock: 9 })]),
      'actor-1',
    );

    expect(result).toMatchObject({ success: true, created: 1, updated: 0 });
    expect(create).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledWith({
      where: {
        productId_warehouseId: {
          productId: 'p-new',
          warehouseId: 'wh-catalog',
        },
      },
      create: {
        productId: 'p-new',
        warehouseId: 'wh-catalog',
        quantity: 9,
        reservedQuantity: 0,
      },
      update: { quantity: 9 },
    });
  });

  it('updates an existing row when the CSV carries an id', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'p-1' });
    const service = new ProductsService(
      makePrisma({
        product: {
          findUnique: jest.fn().mockResolvedValue({ id: 'p-1', sku: 'DP-1' }),
          update,
        },
      }),
      makeAudit().audit,
    );

    const result = await service.importCsv(
      toCsv([{ ...csvRow(), id: 'p-1' }]),
      'actor-1',
    );

    expect(result).toMatchObject({ success: true, created: 0, updated: 1 });
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('records a per-row failure when a write hits a duplicate SKU', async () => {
    const create = jest.fn().mockRejectedValue(new ConflictException());
    const service = new ProductsService(
      makePrisma({
        product: { findUnique: jest.fn().mockResolvedValue(null), create },
      }),
      makeAudit().audit,
    );

    const result = await service.importCsv(toCsv([csvRow()]), 'actor-1');

    expect(result.success).toBe(false);
    expect(result.errors[0]).toMatchObject({ line: 2 });
    expect(result.errors[0].message).toContain('SKU');
  });

  it('creates the catalog warehouse when it does not exist yet', async () => {
    const warehouseCreate = jest.fn().mockResolvedValue({ id: 'wh-made' });
    const inventoryUpsert = jest.fn().mockResolvedValue(undefined);
    const service = new ProductsService(
      makePrisma({
        product: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: 'p-new' }),
        },
        warehouse: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: warehouseCreate,
        },
        inventory: { upsert: inventoryUpsert },
      }),
      makeAudit().audit,
    );

    await service.importCsv(toCsv([csvRow()]), 'actor-1');

    expect(warehouseCreate).toHaveBeenCalledWith({
      data: { name: "Katalog (ko'chirilgan)" },
    });
    expect(inventoryUpsert).toHaveBeenCalledWith({
      where: {
        productId_warehouseId: { productId: 'p-new', warehouseId: 'wh-made' },
      },
      create: {
        productId: 'p-new',
        warehouseId: 'wh-made',
        quantity: 7,
        reservedQuantity: 0,
      },
      update: { quantity: 7 },
    });
  });
});

describe('ProductsService.exportCsv', () => {
  it('writes the computed available quantity into the stock column', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'p-1',
        sku: 'DP-1',
        slug: 'dp-1',
        oemNumbers: [],
        nameUz: 'A',
        nameRu: 'A',
        nameEn: 'A',
        descriptionUz: '',
        descriptionRu: '',
        descriptionEn: '',
        price: 100,
        minStock: 2,
        categoryId: 'c1',
        brandId: 'b1',
        compatibleModels: [],
        isActive: true,
        inventories: [{ quantity: 10, reservedQuantity: 3 }],
      },
    ]);
    const service = new ProductsService(
      makePrisma({ product: { findMany } }),
      makeAudit().audit,
    );

    const csv = await service.exportCsv();
    const body = csv.charCodeAt(0) === 0xfeff ? csv.slice(1) : csv;
    const dataLine = body.split('\r\n')[1].split(',');

    // header: id,sku,slug,oemNumbers,nameUz,nameRu,nameEn,descriptionUz,
    //   descriptionRu,descriptionEn,price,stock,minStock,...
    expect(dataLine[11]).toBe('7');
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { sku: 'asc' } }),
    );
  });
});

describe('ProductsService.setImage', () => {
  it('updates imageUrl and records an audit entry', async () => {
    const findUnique = jest.fn().mockResolvedValue(row);
    const update = jest.fn().mockResolvedValue({ ...row });
    const { audit, record } = makeAudit();
    const service = new ProductsService(
      makePrisma({ product: { findUnique, update } }),
      audit,
    );

    await service.setImage('p1', 'https://example.com/img.jpg', 'actor-1');

    expect(update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { imageUrl: 'https://example.com/img.jpg' },
    });
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'actor-1',
        action: AuditAction.UPDATE,
        entityType: 'Product',
        entityId: 'p1',
      }),
    );
  });

  it('404s when the product does not exist', async () => {
    const service = new ProductsService(
      makePrisma({
        product: { findUnique: jest.fn().mockResolvedValue(null) },
      }),
      makeAudit().audit,
    );

    await expect(
      service.setImage('missing', 'https://example.com/img.jpg', 'actor-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('ProductsService.search', () => {
  function matchable(overrides: Record<string, unknown> = {}) {
    return {
      id: 'p1',
      sku: 'DP-1',
      nameUz: 'Nasos',
      oemNumbers: ['OEM-1'],
      price: 100,
      currency: 'UZS',
      minStock: 2,
      inventories: [{ quantity: 5, reservedQuantity: 0 }],
      ...overrides,
    };
  }

  it('searches by name, sku or oem number, excluding retired products', async () => {
    const findMany = jest.fn<
      Promise<ReturnType<typeof matchable>[]>,
      [{ where: { isActive: boolean } }]
    >();
    findMany.mockResolvedValue([matchable()]);
    const service = new ProductsService(
      makePrisma({ product: { findMany } }),
      makeAudit().audit,
    );

    await service.search('nasos');

    expect(findMany.mock.calls[0][0].where.isActive).toBe(true);
  });

  it('never returns purchasePrice and shapes the seller-facing fields', async () => {
    const findMany = jest.fn().mockResolvedValue([matchable()]);
    const service = new ProductsService(
      makePrisma({ product: { findMany } }),
      makeAudit().audit,
    );

    const result = await service.search('nasos');

    expect(result).toEqual([
      {
        id: 'p1',
        sku: 'DP-1',
        name: 'Nasos',
        oemNumbers: ['OEM-1'],
        price: 100,
        currency: 'UZS',
        stock: 5,
        stockStatus: 'IN_STOCK',
      },
    ]);
  });

  it('sorts in-stock rows first, then more than 8 results are capped to 8', async () => {
    const matches = Array.from({ length: 10 }, (_, i) =>
      matchable({
        id: `p${i}`,
        sku: `DP-${i}`,
        nameUz: `Item ${i}`,
        inventories: [{ quantity: i, reservedQuantity: 0 }],
      }),
    );
    const findMany = jest.fn().mockResolvedValue(matches);
    const service = new ProductsService(
      makePrisma({ product: { findMany } }),
      makeAudit().audit,
    );

    const result = await service.search('item');

    expect(result).toHaveLength(8);
    expect(result[0].id).toBe('p9');
  });
});
