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
