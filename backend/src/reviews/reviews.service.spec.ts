import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus, Prisma } from '../../generated/prisma/client';

function makePrisma(
  overrides: {
    review?: Record<string, unknown>;
    orderItem?: Record<string, unknown>;
  } = {},
) {
  return {
    review: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      ...overrides.review,
    },
    orderItem: {
      findMany: jest.fn().mockResolvedValue([]),
      ...overrides.orderItem,
    },
  } as unknown as PrismaService;
}

describe('ReviewsService', () => {
  describe('listForProduct', () => {
    it('scopes to the product and only approved rows', async () => {
      const count = jest.fn().mockResolvedValue(0);
      const findMany = jest.fn().mockResolvedValue([]);
      const prisma = makePrisma({ review: { count, findMany } });
      const service = new ReviewsService(prisma);

      await service.listForProduct('prod-1', 1, 5, null);

      expect(count).toHaveBeenCalledWith({
        where: { productId: 'prod-1', isApproved: true },
      });
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { productId: 'prod-1', isApproved: true },
        }),
      );
    });

    it('marks the caller"s own row isMine and never returns authorPhone', async () => {
      const count = jest.fn().mockResolvedValue(1);
      const findMany = jest.fn().mockResolvedValue([
        {
          id: 'rev-1',
          rating: 5,
          body: 'Great part',
          authorName: 'Ali',
          createdAt: new Date('2026-01-01'),
          authorPhone: '998901234567',
        },
      ]);
      const prisma = makePrisma({ review: { count, findMany } });
      const service = new ReviewsService(prisma);

      const result = await service.listForProduct(
        'prod-1',
        1,
        5,
        '998901234567',
      );

      expect(result.data[0].isMine).toBe(true);
      expect(result.data[0]).not.toHaveProperty('authorPhone');
    });

    it('does not mark isMine when ownPhone is null', async () => {
      const count = jest.fn().mockResolvedValue(1);
      const findMany = jest.fn().mockResolvedValue([
        {
          id: 'rev-1',
          rating: 5,
          body: 'Great part',
          authorName: 'Ali',
          createdAt: new Date('2026-01-01'),
          authorPhone: '998901234567',
        },
      ]);
      const prisma = makePrisma({ review: { count, findMany } });
      const service = new ReviewsService(prisma);

      const result = await service.listForProduct('prod-1', 1, 5, null);

      expect(result.data[0].isMine).toBeUndefined();
    });

    it('defaults a null body to an empty string', async () => {
      const count = jest.fn().mockResolvedValue(1);
      const findMany = jest.fn().mockResolvedValue([
        {
          id: 'rev-1',
          rating: 4,
          body: null,
          authorName: 'Ali',
          createdAt: new Date('2026-01-01'),
          authorPhone: '998901234567',
        },
      ]);
      const prisma = makePrisma({ review: { count, findMany } });
      const service = new ReviewsService(prisma);

      const result = await service.listForProduct('prod-1', 1, 5, null);

      expect(result.data[0].body).toBe('');
    });

    it('clamps a page beyond the last page down to totalPages', async () => {
      const count = jest.fn().mockResolvedValue(3);
      const findMany = jest.fn().mockResolvedValue([]);
      const prisma = makePrisma({ review: { count, findMany } });
      const service = new ReviewsService(prisma);

      const result = await service.listForProduct('prod-1', 99, 5, null);

      expect(result.meta.page).toBe(1);
      expect(result.meta.totalPages).toBe(1);
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0 }),
      );
    });
  });

  describe('upsert', () => {
    it('upserts on the product/author unique index and marks isMine', async () => {
      const upsert = jest.fn().mockResolvedValue({
        id: 'rev-1',
        rating: 5,
        body: 'Great part',
        authorName: 'Ali',
        createdAt: new Date('2026-01-01'),
      });
      const prisma = makePrisma({ review: { upsert } });
      const service = new ReviewsService(prisma);

      const result = await service.upsert(
        {
          productId: 'prod-1',
          rating: 5,
          body: 'Great part',
          authorName: 'Ali',
        },
        '998901234567',
      );

      expect(upsert).toHaveBeenCalledWith({
        where: {
          productId_authorPhone: {
            productId: 'prod-1',
            authorPhone: '998901234567',
          },
        },
        create: {
          productId: 'prod-1',
          authorPhone: '998901234567',
          rating: 5,
          body: 'Great part',
          authorName: 'Ali',
        },
        update: { rating: 5, body: 'Great part', authorName: 'Ali' },
        select: {
          id: true,
          rating: true,
          body: true,
          authorName: true,
          createdAt: true,
        },
      });
      expect(result.isMine).toBe(true);
    });

    it('never touches isApproved on the update branch', async () => {
      const upsert = jest.fn().mockResolvedValue({
        id: 'rev-1',
        rating: 3,
        body: 'Changed my mind',
        authorName: 'Ali',
        createdAt: new Date('2026-01-01'),
      });
      const prisma = makePrisma({ review: { upsert } });
      const service = new ReviewsService(prisma);

      await service.upsert(
        {
          productId: 'prod-1',
          rating: 3,
          body: 'Changed my mind',
          authorName: 'Ali',
        },
        '998901234567',
      );

      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { rating: 3, body: 'Changed my mind', authorName: 'Ali' },
        }),
      );
    });

    it('maps a foreign-key violation to a 400', async () => {
      const upsert = jest.fn().mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('FK violation', {
          code: 'P2003',
          clientVersion: 'test',
        }),
      );
      const prisma = makePrisma({ review: { upsert } });
      const service = new ReviewsService(prisma);

      await expect(
        service.upsert(
          {
            productId: 'missing-product',
            rating: 5,
            body: 'Great part',
            authorName: 'Ali',
          },
          '998901234567',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rethrows an unrelated error', async () => {
      const upsert = jest.fn().mockRejectedValue(new Error('db down'));
      const prisma = makePrisma({ review: { upsert } });
      const service = new ReviewsService(prisma);

      await expect(
        service.upsert(
          {
            productId: 'prod-1',
            rating: 5,
            body: 'Great part',
            authorName: 'Ali',
          },
          '998901234567',
        ),
      ).rejects.toThrow('db down');
    });
  });

  describe('getOwn', () => {
    it('returns null when there is no review from this phone', async () => {
      const findUnique = jest.fn().mockResolvedValue(null);
      const prisma = makePrisma({ review: { findUnique } });
      const service = new ReviewsService(prisma);

      const result = await service.getOwn('prod-1', '998901234567');

      expect(result).toBeNull();
    });

    it('marks isMine true when found', async () => {
      const findUnique = jest.fn().mockResolvedValue({
        id: 'rev-1',
        rating: 5,
        body: 'Great part',
        authorName: 'Ali',
        createdAt: new Date('2026-01-01'),
      });
      const prisma = makePrisma({ review: { findUnique } });
      const service = new ReviewsService(prisma);

      const result = await service.getOwn('prod-1', '998901234567');

      expect(result?.isMine).toBe(true);
    });
  });

  describe('listAll', () => {
    it('includes hidden rows and maps the product name from nameUz', async () => {
      const count = jest.fn().mockResolvedValue(1);
      const findMany = jest.fn().mockResolvedValue([
        {
          id: 'rev-1',
          rating: 1,
          body: 'Spam',
          authorName: 'X',
          createdAt: new Date('2026-01-01'),
          isApproved: false,
          product: { id: 'prod-1', slug: 'part-1', nameUz: 'Filtr' },
        },
      ]);
      const prisma = makePrisma({ review: { count, findMany } });
      const service = new ReviewsService(prisma);

      const result = await service.listAll(1, 20);

      expect(count).toHaveBeenCalledWith({ where: {} });
      expect(result.data[0].isApproved).toBe(false);
      expect(result.data[0].product).toEqual({
        id: 'prod-1',
        slug: 'part-1',
        name: 'Filtr',
      });
    });

    it('filters by productId when given', async () => {
      const count = jest.fn().mockResolvedValue(0);
      const findMany = jest.fn().mockResolvedValue([]);
      const prisma = makePrisma({ review: { count, findMany } });
      const service = new ReviewsService(prisma);

      await service.listAll(1, 20, 'prod-1');

      expect(count).toHaveBeenCalledWith({ where: { productId: 'prod-1' } });
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { productId: 'prod-1' } }),
      );
    });
  });

  describe('setApproval', () => {
    it('throws NotFoundException when the review does not exist', async () => {
      const findUnique = jest.fn().mockResolvedValue(null);
      const prisma = makePrisma({ review: { findUnique } });
      const service = new ReviewsService(prisma);

      await expect(
        service.setApproval('missing', false),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('updates isApproved when found', async () => {
      const findUnique = jest.fn().mockResolvedValue({ id: 'rev-1' });
      const update = jest.fn().mockResolvedValue({});
      const prisma = makePrisma({ review: { findUnique, update } });
      const service = new ReviewsService(prisma);

      const result = await service.setApproval('rev-1', false);

      expect(update).toHaveBeenCalledWith({
        where: { id: 'rev-1' },
        data: { isApproved: false },
      });
      expect(result).toEqual({ success: true, id: 'rev-1' });
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when the review does not exist', async () => {
      const findUnique = jest.fn().mockResolvedValue(null);
      const prisma = makePrisma({ review: { findUnique } });
      const service = new ReviewsService(prisma);

      await expect(service.remove('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('deletes when found', async () => {
      const findUnique = jest.fn().mockResolvedValue({ id: 'rev-1' });
      const del = jest.fn().mockResolvedValue({});
      const prisma = makePrisma({ review: { findUnique, delete: del } });
      const service = new ReviewsService(prisma);

      const result = await service.remove('rev-1');

      expect(del).toHaveBeenCalledWith({ where: { id: 'rev-1' } });
      expect(result).toEqual({ success: true, id: 'rev-1' });
    });
  });

  describe('hasPurchased', () => {
    it('returns false for an invalid phone without querying', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const prisma = makePrisma({ orderItem: { findMany } });
      const service = new ReviewsService(prisma);

      const result = await service.hasPurchased('prod-1', '123');

      expect(result).toBe(false);
      expect(findMany).not.toHaveBeenCalled();
    });

    it('scopes to COMPLETED orders and the phone-tail prefilter', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const prisma = makePrisma({ orderItem: { findMany } });
      const service = new ReviewsService(prisma);

      await service.hasPurchased('prod-1', '+998 90 123-45-67');

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            productId: 'prod-1',
            order: {
              status: OrderStatus.COMPLETED,
              customer: { phone: { contains: '67' } },
            },
          },
          take: 500,
        }),
      );
    });

    it('returns true only when a row"s canonical digits match exactly', async () => {
      const findMany = jest
        .fn()
        .mockResolvedValue([
          { order: { customer: { phone: '+998 91 999-45-67' } } },
          { order: { customer: { phone: '+998 90 123-45-67' } } },
        ]);
      const prisma = makePrisma({ orderItem: { findMany } });
      const service = new ReviewsService(prisma);

      const result = await service.hasPurchased('prod-1', '998901234567');

      expect(result).toBe(true);
    });

    it('returns false when no row matches on canonical digits', async () => {
      const findMany = jest
        .fn()
        .mockResolvedValue([
          { order: { customer: { phone: '+998 91 999-45-67' } } },
        ]);
      const prisma = makePrisma({ orderItem: { findMany } });
      const service = new ReviewsService(prisma);

      const result = await service.hasPurchased('prod-1', '998901234567');

      expect(result).toBe(false);
    });
  });
});
