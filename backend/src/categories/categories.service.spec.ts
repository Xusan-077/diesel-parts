import { CategoriesService } from './categories.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../../generated/prisma/client';

function makePrisma(overrides: { category?: Record<string, unknown> } = {}) {
  return {
    category: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn().mockResolvedValue({}),
      ...overrides.category,
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
