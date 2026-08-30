import { BadRequestException, ConflictException } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../../generated/prisma/client';

function makePrisma(
  overrides: {
    category?: Record<string, unknown>;
    product?: Record<string, unknown>;
  } = {},
) {
  return {
    category: {
      findUnique: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn().mockResolvedValue({}),
      ...overrides.category,
    },
    product: {
      count: jest.fn().mockResolvedValue(0),
      ...overrides.product,
    },
  } as unknown as PrismaService;
}

function makeAudit() {
  const record = jest.fn().mockResolvedValue(undefined);
  return { audit: { record } as unknown as AuditService, record };
}

const row = {
  id: 'c1',
  slug: 'engine',
  nameUz: 'Dvigatel',
  type: 'engine',
  parentId: null,
  order: 0,
};

const snapshot = {
  slug: 'engine',
  name: 'Dvigatel',
  type: 'engine',
  parentId: null,
  order: 0,
};

describe('CategoriesService audit', () => {
  it('records a CREATE with an after snapshot', async () => {
    const prisma = makePrisma({
      category: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(row),
      },
    });
    const { audit, record } = makeAudit();
    const service = new CategoriesService(prisma, audit);

    await service.create({ slug: 'engine' } as never, 'actor-1');

    expect(record).toHaveBeenCalledWith({
      userId: 'actor-1',
      action: AuditAction.CREATE,
      entityType: 'Category',
      entityId: 'c1',
      after: snapshot,
    });
  });

  it('records an UPDATE with before and after snapshots', async () => {
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce(row) // findOne
      .mockResolvedValue(null); // assertSlugFree
    const update = jest.fn().mockResolvedValue({ ...row, nameUz: 'Motor' });
    const prisma = makePrisma({ category: { findUnique, update } });
    const { audit, record } = makeAudit();
    const service = new CategoriesService(prisma, audit);

    await service.update('c1', { nameUz: 'Motor' }, 'actor-1');

    expect(record).toHaveBeenCalledWith({
      userId: 'actor-1',
      action: AuditAction.UPDATE,
      entityType: 'Category',
      entityId: 'c1',
      before: snapshot,
      after: { ...snapshot, name: 'Motor' },
    });
  });

  it('records a DELETE with a before snapshot', async () => {
    const findUnique = jest.fn().mockResolvedValue(row);
    const prisma = makePrisma({ category: { findUnique } });
    const { audit, record } = makeAudit();
    const service = new CategoriesService(prisma, audit);

    await service.remove('c1', 'actor-1');

    expect(record).toHaveBeenCalledWith({
      userId: 'actor-1',
      action: AuditAction.DELETE,
      entityType: 'Category',
      entityId: 'c1',
      before: snapshot,
    });
  });
});

function makeTreePrisma(rows: unknown[]) {
  const findMany = jest.fn().mockResolvedValue(rows);
  return {
    prisma: { category: { findMany } } as unknown as PrismaService,
    findMany,
  };
}

describe('CategoriesService.findTree', () => {
  const { audit } = makeAudit();

  it('nests children under their root, preserving the DB order', async () => {
    // Rows arrive already ordered by [order asc, nameUz asc] from the query.
    const rows = [
      { id: 'root-a', parentId: null, order: 0, nameUz: 'Anhydrid' },
      { id: 'root-b', parentId: null, order: 0, nameUz: 'Brakes' },
      { id: 'child-b2', parentId: 'root-b', order: 1, nameUz: 'Discs' },
      { id: 'child-b1', parentId: 'root-b', order: 2, nameUz: 'Pads' },
    ];
    const { prisma, findMany } = makeTreePrisma(rows);
    const service = new CategoriesService(prisma, audit);

    const tree = await service.findTree();

    expect(findMany).toHaveBeenCalledWith({
      orderBy: [{ order: 'asc' }, { nameUz: 'asc' }],
    });
    expect(tree.map((n) => n.id)).toEqual(['root-a', 'root-b']);
    expect(tree[1].children.map((c) => c.id)).toEqual(['child-b2', 'child-b1']);
    expect(tree[0].children).toEqual([]);
  });

  it('treats a row with a missing parent as a root', async () => {
    const rows = [
      { id: 'orphan', parentId: 'gone', order: 0, nameUz: 'Orphan' },
    ];
    const { prisma } = makeTreePrisma(rows);
    const service = new CategoriesService(prisma, audit);

    const tree = await service.findTree();

    expect(tree.map((n) => n.id)).toEqual(['orphan']);
  });
});

describe('CategoriesService.findAll', () => {
  it('includes the child and product counts the admin listing needs', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = makePrisma({ category: { findMany } });
    const { audit } = makeAudit();
    const service = new CategoriesService(prisma, audit);

    await service.findAll();

    expect(findMany).toHaveBeenCalledWith({
      orderBy: { nameEn: 'asc' },
      include: { _count: { select: { children: true, products: true } } },
    });
  });
});

describe('CategoriesService.create parent validation', () => {
  it('refuses a parent that does not exist', async () => {
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce(null) // assertSlugFree
      .mockResolvedValueOnce(null); // assertValidParent's own lookup
    const prisma = makePrisma({ category: { findUnique } });
    const { audit } = makeAudit();
    const service = new CategoriesService(prisma, audit);

    let error: unknown;
    try {
      await service.create(
        { slug: 'engine', parentId: 'missing' } as never,
        'actor-1',
      );
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getResponse()).toMatchObject({
      error: 'parent_not_found',
    });
  });

  it('refuses a parent that is itself not a root', async () => {
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce(null) // assertSlugFree
      .mockResolvedValueOnce({ parentId: 'root-a' }); // assertValidParent: parent has its own parent
    const prisma = makePrisma({ category: { findUnique } });
    const { audit } = makeAudit();
    const service = new CategoriesService(prisma, audit);

    let error: unknown;
    try {
      await service.create(
        { slug: 'engine', parentId: 'child-x' } as never,
        'actor-1',
      );
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getResponse()).toMatchObject({
      error: 'parent_not_root',
    });
  });
});

describe('CategoriesService.update parent validation', () => {
  it('refuses a category pointing at itself as its own parent', async () => {
    const findUnique = jest.fn().mockResolvedValueOnce(row); // findOne
    const prisma = makePrisma({ category: { findUnique } });
    const { audit } = makeAudit();
    const service = new CategoriesService(prisma, audit);

    let error: unknown;
    try {
      await service.update('c1', { parentId: 'c1' }, 'actor-1');
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getResponse()).toMatchObject({
      error: 'parent_not_root',
    });
  });

  it('refuses turning a root with children into a child', async () => {
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce(row) // findOne — a root (parentId: null)
      .mockResolvedValueOnce({ parentId: null }); // assertValidParent: the new parent is a valid root
    const count = jest.fn().mockResolvedValue(2); // it has children
    const prisma = makePrisma({ category: { findUnique, count } });
    const { audit } = makeAudit();
    const service = new CategoriesService(prisma, audit);

    let error: unknown;
    try {
      await service.update('c1', { parentId: 'other-root' }, 'actor-1');
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({
      error: 'has_children',
    });
    expect(count).toHaveBeenCalledWith({ where: { parentId: 'c1' } });
  });
});

describe('CategoriesService.remove delete guards', () => {
  it('refuses when the category has children', async () => {
    const findUnique = jest.fn().mockResolvedValue(row);
    const count = jest.fn().mockResolvedValue(1);
    const prisma = makePrisma({ category: { findUnique, count } });
    const { audit } = makeAudit();
    const service = new CategoriesService(prisma, audit);

    let error: unknown;
    try {
      await service.remove('c1', 'actor-1');
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({
      error: 'has_children',
    });
  });

  it('refuses when the category has products', async () => {
    const findUnique = jest.fn().mockResolvedValue(row);
    const prisma = makePrisma({
      category: { findUnique },
      product: { count: jest.fn().mockResolvedValue(3) },
    });
    const { audit } = makeAudit();
    const service = new CategoriesService(prisma, audit);

    let error: unknown;
    try {
      await service.remove('c1', 'actor-1');
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({
      error: 'has_products',
    });
  });
});
