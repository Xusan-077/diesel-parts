import { ConflictException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction, Role } from '../../generated/prisma/client';

function makeAudit() {
  const record = jest.fn().mockResolvedValue(undefined);
  return { audit: { record } as unknown as AuditService, record };
}

function makePrisma(
  overrides: {
    user?: Record<string, unknown>;
    order?: Record<string, unknown>;
    seller?: Record<string, unknown>;
  } = {},
) {
  return {
    user: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
      update: jest.fn(),
      ...overrides.user,
    },
    order: {
      groupBy: jest.fn().mockResolvedValue([]),
      ...overrides.order,
    },
    seller: {
      findMany: jest.fn().mockResolvedValue([]),
      ...overrides.seller,
    },
  } as unknown as PrismaService;
}

describe('UsersService.findAll', () => {
  it('returns each user with a completedOrders aggregate keyed through their seller profile', async () => {
    const users = [
      {
        id: 'user-1',
        phone: '998901234567',
        role: Role.SELLER,
        isActive: true,
      },
      {
        id: 'user-2',
        phone: '998901234568',
        role: Role.DIRECTOR,
        isActive: true,
      },
    ];
    const findMany = jest.fn().mockResolvedValue(users);
    const groupBy = jest
      .fn()
      .mockResolvedValue([{ sellerId: 'seller-1', _count: { _all: 3 } }]);
    const sellerFindMany = jest
      .fn()
      .mockResolvedValue([{ id: 'seller-1', userId: 'user-1' }]);
    const prisma = makePrisma({
      user: { findMany },
      order: { groupBy },
      seller: { findMany: sellerFindMany },
    });
    const service = new UsersService(prisma, makeAudit().audit);

    const result = await service.findAll();

    expect(groupBy).toHaveBeenCalledWith({
      by: ['sellerId'],
      where: { status: 'COMPLETED' },
      _count: { _all: true },
    });
    expect(result).toEqual([
      { ...users[0], completedOrders: 3 },
      { ...users[1], completedOrders: 0 },
    ]);
  });
});

describe('UsersService.update', () => {
  it('throws when demoting the last active director', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: 'dir-1',
      phone: '998901234567',
      role: Role.DIRECTOR,
      isActive: true,
    });
    const count = jest.fn().mockResolvedValue(0); // no other active directors remain
    const update = jest.fn();
    const prisma = makePrisma({ user: { findUnique, count, update } });
    const service = new UsersService(prisma, makeAudit().audit);

    await expect(
      service.update('dir-1', { isActive: false }, 'actor-1'),
    ).rejects.toThrow(
      new ConflictException('Cannot deactivate the last active director'),
    );
    expect(count).toHaveBeenCalledWith({
      where: { role: Role.DIRECTOR, isActive: true, id: { not: 'dir-1' } },
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('allows demoting a director when another active director remains', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: 'dir-1',
      phone: '998901234567',
      role: Role.DIRECTOR,
      isActive: true,
    });
    const count = jest.fn().mockResolvedValue(1);
    const update = jest.fn().mockResolvedValue({
      id: 'dir-1',
      phone: '998901234567',
      role: Role.MANAGER,
      isActive: true,
    });
    const prisma = makePrisma({ user: { findUnique, count, update } });
    const service = new UsersService(prisma, makeAudit().audit);

    await service.update('dir-1', { role: Role.MANAGER }, 'actor-1');

    expect(count).toHaveBeenCalledWith({
      where: { role: Role.DIRECTOR, isActive: true, id: { not: 'dir-1' } },
    });
    expect(update).toHaveBeenCalled();
  });

  it('does not guard a non-director update', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: 'seller-user',
      phone: '998901234569',
      role: Role.SELLER,
      isActive: true,
    });
    const count = jest.fn();
    const update = jest.fn().mockResolvedValue({});
    const prisma = makePrisma({ user: { findUnique, count, update } });
    const service = new UsersService(prisma, makeAudit().audit);

    await service.update('seller-user', { isActive: false }, 'actor-1');

    expect(count).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalled();
  });

  it('clears the phone when the patch sends an explicit null, rather than leaving it untouched', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: 'seller-user',
      phone: '998901234569',
      role: Role.SELLER,
      isActive: true,
    });
    const update = jest.fn().mockResolvedValue({});
    const prisma = makePrisma({ user: { findUnique, update } });
    const service = new UsersService(prisma, makeAudit().audit);

    await service.update('seller-user', { phone: null }, 'actor-1');

    const [call] = update.mock.calls[0] as [{ data: Record<string, unknown> }];
    expect(call.data).toEqual({ phone: null });
  });
});

describe('UsersService.remove', () => {
  it('throws when removing the last active director', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: 'dir-1',
      phone: '998901234567',
      role: Role.DIRECTOR,
      isActive: true,
    });
    const count = jest.fn().mockResolvedValue(0);
    const update = jest.fn();
    const prisma = makePrisma({ user: { findUnique, count, update } });
    const service = new UsersService(prisma, makeAudit().audit);

    await expect(service.remove('dir-1', 'actor-1')).rejects.toThrow(
      ConflictException,
    );
    expect(update).not.toHaveBeenCalled();
  });
});

describe('UsersService audit', () => {
  it('records a CREATE with a snapshot that omits the password hash', async () => {
    const created = {
      id: 'u1',
      name: 'Vali',
      email: 'vali@dieselparts.uz',
      phone: '998901234567',
      role: Role.SELLER,
      isActive: true,
      discountLimit: 5,
    };
    const prisma = makePrisma({
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(created),
      },
    });
    const { audit, record } = makeAudit();
    const service = new UsersService(prisma, audit);

    await service.create(
      {
        name: 'Vali',
        email: 'vali@dieselparts.uz',
        phone: '998901234567',
        password: 'secret123',
        role: Role.SELLER,
      },
      'actor-1',
    );

    expect(record).toHaveBeenCalledWith({
      userId: 'actor-1',
      action: AuditAction.CREATE,
      entityType: 'User',
      entityId: 'u1',
      after: {
        name: 'Vali',
        email: 'vali@dieselparts.uz',
        phone: '998901234567',
        role: Role.SELLER,
        isActive: true,
        discountLimit: 5,
      },
    });
  });

  it('checks for a duplicate by email, not phone -- an email-primary account has no phone to check', async () => {
    const findUnique = jest.fn().mockResolvedValue({ id: 'existing' });
    const create = jest.fn();
    const prisma = makePrisma({ user: { findUnique, create } });
    const service = new UsersService(prisma, makeAudit().audit);

    await expect(
      service.create(
        {
          name: 'Director',
          email: 'director@dieselparts.uz',
          password: 'secret123',
          role: Role.DIRECTOR,
        },
        'actor-1',
      ),
    ).rejects.toThrow(new ConflictException('Email already registered'));
    expect(findUnique).toHaveBeenCalledWith({
      where: { email: 'director@dieselparts.uz' },
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('creates an account with no phone at all', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'u2',
      name: 'Director',
      email: 'director@dieselparts.uz',
      phone: null,
      role: Role.DIRECTOR,
      isActive: true,
      discountLimit: 100,
    });
    const prisma = makePrisma({
      user: { findUnique: jest.fn().mockResolvedValue(null), create },
    });
    const service = new UsersService(prisma, makeAudit().audit);

    await service.create(
      {
        name: 'Director',
        email: 'director@dieselparts.uz',
        password: 'secret123',
        role: Role.DIRECTOR,
      },
      'actor-1',
    );

    const [call] = create.mock.calls[0] as [{ data: Record<string, unknown> }];
    expect(call.data).toMatchObject({
      name: 'Director',
      email: 'director@dieselparts.uz',
      phone: null,
      role: Role.DIRECTOR,
      discountLimit: 5,
      isActive: true,
    });
  });

  it('records an UPDATE with before and after snapshots', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: 'u1',
      phone: '998901234567',
      role: Role.SELLER,
      isActive: true,
    });
    const update = jest.fn().mockResolvedValue({
      id: 'u1',
      phone: '998901234567',
      role: Role.SELLER,
      isActive: false,
    });
    const prisma = makePrisma({ user: { findUnique, update } });
    const { audit, record } = makeAudit();
    const service = new UsersService(prisma, audit);

    await service.update('u1', { isActive: false }, 'actor-1');

    expect(record).toHaveBeenCalledWith({
      userId: 'actor-1',
      action: AuditAction.UPDATE,
      entityType: 'User',
      entityId: 'u1',
      before: { phone: '998901234567', role: Role.SELLER, isActive: true },
      after: { phone: '998901234567', role: Role.SELLER, isActive: false },
    });
  });

  it('records a DELETE when a user is deactivated', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: 'u1',
      phone: '998901234567',
      role: Role.SELLER,
      isActive: true,
    });
    const update = jest.fn().mockResolvedValue({});
    const prisma = makePrisma({ user: { findUnique, update } });
    const { audit, record } = makeAudit();
    const service = new UsersService(prisma, audit);

    await service.remove('u1', 'actor-1');

    expect(record).toHaveBeenCalledWith({
      userId: 'actor-1',
      action: AuditAction.DELETE,
      entityType: 'User',
      entityId: 'u1',
      before: { phone: '998901234567', role: Role.SELLER, isActive: true },
      after: { phone: '998901234567', role: Role.SELLER, isActive: false },
    });
  });
});
