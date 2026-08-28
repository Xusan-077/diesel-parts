import { ConflictException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../../generated/prisma/client';

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
    const service = new UsersService(prisma);

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
    const service = new UsersService(prisma);

    await expect(service.update('dir-1', { isActive: false })).rejects.toThrow(
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
    const service = new UsersService(prisma);

    await service.update('dir-1', { role: Role.MANAGER });

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
    const service = new UsersService(prisma);

    await service.update('seller-user', { isActive: false });

    expect(count).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalled();
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
    const service = new UsersService(prisma);

    await expect(service.remove('dir-1')).rejects.toThrow(ConflictException);
    expect(update).not.toHaveBeenCalled();
  });
});
