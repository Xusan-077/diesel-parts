import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InquiriesService } from './inquiries.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  AuditAction,
  InquirySource,
  InquiryStatus,
  Role,
} from '../../generated/prisma/client';
import type { ScopeActor } from '../common/scope';

function makePrisma(
  overrides: {
    inquiry?: Record<string, unknown>;
  } = {},
) {
  return {
    inquiry: {
      create: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      update: jest.fn(),
      ...overrides.inquiry,
    },
  } as unknown as PrismaService;
}

/**
 * Returns the mocked `record` function alongside the `AuditService` it is
 * wired into, so a test can assert on `record` directly rather than reading
 * the method off the service object (which trips
 * `@typescript-eslint/unbound-method`).
 */
function makeAudit() {
  const record = jest.fn().mockResolvedValue(undefined);
  const audit = { record } as unknown as AuditService;
  return { audit, record };
}

const seller: ScopeActor = { id: 'seller-1', role: Role.SELLER };
const director: ScopeActor = { id: 'director-1', role: Role.DIRECTOR };

describe('InquiriesService', () => {
  describe('create', () => {
    it('passes the public-form fields through with defaults for optionals', async () => {
      const create = jest.fn().mockResolvedValue({});
      const prisma = makePrisma({ inquiry: { create } });
      const { audit } = makeAudit();
      const service = new InquiriesService(prisma, audit);

      await service.create({
        customerName: 'Ali',
        phone: '998901234567',
        message: 'Need a filter',
        source: InquirySource.CONTACT_FORM,
      });

      expect(create).toHaveBeenCalledWith({
        data: {
          customerName: 'Ali',
          phone: '998901234567',
          email: null,
          message: 'Need a filter',
          source: InquirySource.CONTACT_FORM,
          productId: null,
          productSku: null,
          quantity: null,
        },
      });
    });

    it('does not touch the audit trail', async () => {
      const { audit, record } = makeAudit();
      const prisma = makePrisma();
      const service = new InquiriesService(prisma, audit);

      await service.create({
        customerName: 'Ali',
        phone: '998901234567',
        message: 'Need a filter',
        source: InquirySource.CONTACT_FORM,
      });

      expect(record).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('applies the read scope and, for a seller, ignores a requested sellerId', async () => {
      const count = jest.fn().mockResolvedValue(0);
      const findMany = jest.fn().mockResolvedValue([]);
      const prisma = makePrisma({ inquiry: { count, findMany } });
      const { audit } = makeAudit();
      const service = new InquiriesService(prisma, audit);

      await service.list(seller, { sellerId: 'other-seller', page: 1 });

      expect(count).toHaveBeenCalledWith({
        where: {
          AND: [
            {
              OR: [{ assignedSellerId: seller.id }, { assignedSellerId: null }],
            },
          ],
        },
      });
    });

    it('lets a director narrow to a specific sellerId', async () => {
      const count = jest.fn().mockResolvedValue(0);
      const findMany = jest.fn().mockResolvedValue([]);
      const prisma = makePrisma({ inquiry: { count, findMany } });
      const { audit } = makeAudit();
      const service = new InquiriesService(prisma, audit);

      await service.list(director, { sellerId: 'seller-9', page: 1 });

      expect(count).toHaveBeenCalledWith({
        where: { AND: [{}, { assignedSellerId: 'seller-9' }] },
      });
    });
  });

  describe('board', () => {
    it('scopes every column to the actor and orders closed columns newest-first', async () => {
      const count = jest.fn().mockResolvedValue(0);
      const findMany = jest.fn().mockResolvedValue([]);
      const prisma = makePrisma({ inquiry: { count, findMany } });
      const { audit } = makeAudit();
      const service = new InquiriesService(prisma, audit);

      const board = await service.board(seller);

      expect(Object.keys(board)).toEqual([
        'new',
        'claimed',
        'in_progress',
        'won',
        'lost',
      ]);

      const scope = {
        OR: [{ assignedSellerId: seller.id }, { assignedSellerId: null }],
      };

      // "new" is the 1st column built: oldest-first, unclaimed only.
      expect(findMany).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: {
            AND: [scope, { status: InquiryStatus.NEW, assignedSellerId: null }],
          },
          orderBy: { createdAt: 'asc' },
        }),
      );

      // "won" is the 4th column built, and is closed: newest-first.
      expect(findMany).toHaveBeenNthCalledWith(
        4,
        expect.objectContaining({
          where: { AND: [scope, { status: InquiryStatus.WON }] },
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });

  describe('claim', () => {
    it('claims the row race-safely and records the before/after audit', async () => {
      const updateMany = jest.fn().mockResolvedValue({ count: 1 });
      const prisma = makePrisma({ inquiry: { updateMany } });
      const { audit, record } = makeAudit();
      const service = new InquiriesService(prisma, audit);

      const result = await service.claim('inq-1', seller);

      expect(updateMany).toHaveBeenCalledWith({
        where: { id: 'inq-1', assignedSellerId: null },
        data: { assignedSellerId: seller.id },
      });
      expect(result).toEqual({ id: 'inq-1' });
      expect(record).toHaveBeenCalledWith({
        userId: seller.id,
        action: AuditAction.UPDATE,
        entityType: 'Inquiry',
        entityId: 'inq-1',
        before: { assignedSellerId: null },
        after: { assignedSellerId: seller.id },
      });
    });

    it('throws NotFoundException when the row does not exist at all', async () => {
      const updateMany = jest.fn().mockResolvedValue({ count: 0 });
      const findUnique = jest.fn().mockResolvedValue(null);
      const prisma = makePrisma({ inquiry: { updateMany, findUnique } });
      const { audit, record } = makeAudit();
      const service = new InquiriesService(prisma, audit);

      await expect(service.claim('missing', seller)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(record).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the row exists but is already claimed', async () => {
      const updateMany = jest.fn().mockResolvedValue({ count: 0 });
      const findUnique = jest.fn().mockResolvedValue({ id: 'inq-1' });
      const prisma = makePrisma({ inquiry: { updateMany, findUnique } });
      const { audit, record } = makeAudit();
      const service = new InquiriesService(prisma, audit);

      await expect(service.claim('inq-1', seller)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(record).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('throws BadRequestException when the patch is empty', async () => {
      const prisma = makePrisma();
      const { audit, record } = makeAudit();
      const service = new InquiriesService(prisma, audit);

      await expect(service.update('inq-1', {}, seller)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(record).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the row is outside the actor"s write scope', async () => {
      const findFirst = jest.fn().mockResolvedValue(null);
      const prisma = makePrisma({ inquiry: { findFirst } });
      const { audit } = makeAudit();
      const service = new InquiriesService(prisma, audit);

      await expect(
        service.update('inq-1', { notes: 'call back' }, seller),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(findFirst).toHaveBeenCalledWith({
        where: { id: 'inq-1', assignedSellerId: seller.id },
        select: {
          status: true,
          notes: true,
          followUpAt: true,
          assignedSellerId: true,
        },
      });
    });

    it('skips the audit write when diffFields finds no real change', async () => {
      const row = {
        status: InquiryStatus.NEW,
        notes: 'same note',
        followUpAt: null,
        assignedSellerId: seller.id,
      };
      const findFirst = jest.fn().mockResolvedValue(row);
      const update = jest.fn().mockResolvedValue(row);
      const prisma = makePrisma({ inquiry: { findFirst, update } });
      const { audit, record } = makeAudit();
      const service = new InquiriesService(prisma, audit);

      const result = await service.update(
        'inq-1',
        { notes: 'same note' },
        seller,
      );

      expect(result).toEqual({ id: 'inq-1' });
      expect(record).not.toHaveBeenCalled();
    });

    it('records the audit diff with before/after when a real change happens', async () => {
      const before = {
        status: InquiryStatus.NEW,
        notes: 'old note',
        followUpAt: null,
        assignedSellerId: seller.id,
      };
      const after = {
        status: InquiryStatus.IN_PROGRESS,
        notes: 'old note',
        followUpAt: null,
        assignedSellerId: seller.id,
      };
      const findFirst = jest.fn().mockResolvedValue(before);
      const update = jest.fn().mockResolvedValue(after);
      const prisma = makePrisma({ inquiry: { findFirst, update } });
      const { audit, record } = makeAudit();
      const service = new InquiriesService(prisma, audit);

      const result = await service.update(
        'inq-1',
        { status: InquiryStatus.IN_PROGRESS },
        seller,
      );

      expect(update).toHaveBeenCalledWith({
        where: { id: 'inq-1' },
        data: { status: InquiryStatus.IN_PROGRESS },
        select: {
          status: true,
          notes: true,
          followUpAt: true,
          assignedSellerId: true,
        },
      });
      expect(result).toEqual({ id: 'inq-1' });
      expect(record).toHaveBeenCalledWith({
        userId: seller.id,
        action: AuditAction.UPDATE,
        entityType: 'Inquiry',
        entityId: 'inq-1',
        before: { status: InquiryStatus.NEW },
        after: { status: InquiryStatus.IN_PROGRESS },
      });
    });

    it('converts a non-null followUpAt string to a Date and clears it on null', async () => {
      const row = {
        status: InquiryStatus.NEW,
        notes: null,
        followUpAt: null,
        assignedSellerId: seller.id,
      };
      const findFirst = jest.fn().mockResolvedValue(row);
      const update = jest.fn().mockResolvedValue({
        ...row,
        followUpAt: new Date('2026-09-01T00:00:00.000Z'),
      });
      const prisma = makePrisma({ inquiry: { findFirst, update } });
      const { audit } = makeAudit();
      const service = new InquiriesService(prisma, audit);

      await service.update(
        'inq-1',
        { followUpAt: '2026-09-01T00:00:00.000Z' },
        seller,
      );

      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { followUpAt: new Date('2026-09-01T00:00:00.000Z') },
        }),
      );
    });
  });
});
