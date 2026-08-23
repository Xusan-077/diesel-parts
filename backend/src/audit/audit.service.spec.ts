import { AuditService } from './audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction } from '../../generated/prisma/client';

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    auditLog: {
      create: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      ...overrides,
    },
  } as unknown as PrismaService;
}

describe('AuditService', () => {
  describe('record', () => {
    it('writes an audit log entry with the given fields', async () => {
      const create = jest.fn().mockResolvedValue({});
      const prisma = makePrisma({ create });
      const service = new AuditService(prisma);

      await service.record({
        userId: 'user-1',
        action: AuditAction.UPDATE,
        entityType: 'Product',
        entityId: 'prod-1',
        before: { price: 10 },
        after: { price: 20 },
      });

      expect(create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          action: AuditAction.UPDATE,
          entityType: 'Product',
          entityId: 'prod-1',
          before: { price: 10 },
          after: { price: 20 },
        },
      });
    });

    it('never throws when the write fails, and logs the failure instead', async () => {
      const create = jest.fn().mockRejectedValue(new Error('db down'));
      const prisma = makePrisma({ create });
      const service = new AuditService(prisma);
      const errorSpy = jest
        .spyOn(
          (
            service as unknown as {
              logger: { error: (...a: unknown[]) => void };
            }
          ).logger,
          'error',
        )
        .mockImplementation(() => undefined);

      await expect(
        service.record({
          userId: null,
          action: AuditAction.LOGIN,
          entityType: 'User',
          entityId: 'user-2',
        }),
      ).resolves.toBeUndefined();

      expect(errorSpy).toHaveBeenCalled();
    });

    it('allows a null userId for actions taken before anyone was identified', async () => {
      const create = jest.fn().mockResolvedValue({});
      const prisma = makePrisma({ create });
      const service = new AuditService(prisma);

      await service.record({
        userId: null,
        action: AuditAction.LOGIN,
        entityType: 'User',
        entityId: 'user-3',
      });

      expect(create).toHaveBeenCalledWith({
        data: {
          userId: null,
          action: AuditAction.LOGIN,
          entityType: 'User',
          entityId: 'user-3',
          before: undefined,
          after: undefined,
        },
      });
    });
  });

  describe('findAll', () => {
    it('paginates at 30 per page and maps actorName from the joined user', async () => {
      const count = jest.fn().mockResolvedValue(1);
      const findMany = jest.fn().mockResolvedValue([
        {
          id: 'log-1',
          action: AuditAction.CREATE,
          entityType: 'Product',
          entityId: 'prod-1',
          user: { name: 'Alice' },
          before: null,
          after: { sku: 'ABC' },
          createdAt: new Date('2026-01-01'),
        },
      ]);
      const prisma = makePrisma({ count, findMany });
      const service = new AuditService(prisma);

      const result = await service.findAll(1);

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 30 }),
      );
      expect(result.data[0].actorName).toBe('Alice');
      expect(result.meta).toEqual({
        page: 1,
        limit: 30,
        total: 1,
        totalPages: 1,
      });
    });

    it('returns actorName null when the acting account was deleted', async () => {
      const count = jest.fn().mockResolvedValue(1);
      const findMany = jest.fn().mockResolvedValue([
        {
          id: 'log-1',
          action: AuditAction.DELETE,
          entityType: 'Product',
          entityId: 'prod-1',
          user: null,
          before: { sku: 'ABC' },
          after: null,
          createdAt: new Date('2026-01-01'),
        },
      ]);
      const prisma = makePrisma({ count, findMany });
      const service = new AuditService(prisma);

      const result = await service.findAll(1);

      expect(result.data[0].actorName).toBeNull();
    });

    it('filters by entityType when provided', async () => {
      const count = jest.fn().mockResolvedValue(0);
      const findMany = jest.fn().mockResolvedValue([]);
      const prisma = makePrisma({ count, findMany });
      const service = new AuditService(prisma);

      await service.findAll(1, 'Product');

      expect(count).toHaveBeenCalledWith({ where: { entityType: 'Product' } });
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { entityType: 'Product' } }),
      );
    });

    it('clamps a page below 1 up to 1', async () => {
      const count = jest.fn().mockResolvedValue(5);
      const findMany = jest.fn().mockResolvedValue([]);
      const prisma = makePrisma({ count, findMany });
      const service = new AuditService(prisma);

      const result = await service.findAll(0);

      expect(result.meta.page).toBe(1);
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0 }),
      );
    });

    it('clamps a page beyond the last page down to totalPages', async () => {
      // 31 rows at 30/page => 2 total pages.
      const count = jest.fn().mockResolvedValue(31);
      const findMany = jest.fn().mockResolvedValue([]);
      const prisma = makePrisma({ count, findMany });
      const service = new AuditService(prisma);

      const result = await service.findAll(99);

      expect(result.meta.page).toBe(2);
      expect(result.meta.totalPages).toBe(2);
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 30 }),
      );
    });
  });

  describe('findEntityTypes', () => {
    it('returns the distinct entity types present', async () => {
      const findMany = jest
        .fn()
        .mockResolvedValue([
          { entityType: 'DiscountRequest' },
          { entityType: 'Product' },
        ]);
      const prisma = makePrisma({ findMany });
      const service = new AuditService(prisma);

      const result = await service.findEntityTypes();

      expect(findMany).toHaveBeenCalledWith({
        distinct: ['entityType'],
        select: { entityType: true },
        orderBy: { entityType: 'asc' },
      });
      expect(result).toEqual(['DiscountRequest', 'Product']);
    });
  });
});
