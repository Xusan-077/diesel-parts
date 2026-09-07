import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { WarehousesService } from './warehouses.service';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, WarehouseStatus } from '../../generated/prisma/client';

function firstArg<T>(mock: jest.Mock): T {
  const calls = mock.mock.calls as unknown[][];
  return calls[0][0] as T;
}

function knownError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('boom', {
    code,
    clientVersion: 'test',
  });
}

function makePrisma(over: {
  warehouseFindMany?: jest.Mock;
  warehouseFindUnique?: jest.Mock;
  warehouseCreate?: jest.Mock;
  warehouseUpdate?: jest.Mock;
  inventoryFindMany?: jest.Mock;
}) {
  return {
    warehouse: {
      findMany: over.warehouseFindMany ?? jest.fn().mockResolvedValue([]),
      findUnique:
        over.warehouseFindUnique ?? jest.fn().mockResolvedValue({ id: 'w1' }),
      create: over.warehouseCreate ?? jest.fn().mockResolvedValue({ id: 'w1' }),
      update: over.warehouseUpdate ?? jest.fn().mockResolvedValue({ id: 'w1' }),
      delete: jest.fn().mockResolvedValue({ id: 'w1' }),
    },
    inventory: {
      findMany: over.inventoryFindMany ?? jest.fn().mockResolvedValue([]),
    },
  } as unknown as PrismaService;
}

const dec = (n: number) => new Prisma.Decimal(n);

describe('WarehousesService', () => {
  describe('create', () => {
    it('assigns the next free W<n> when no code is given', async () => {
      const warehouseCreate = jest.fn().mockResolvedValue({ id: 'w4' });
      const service = new WarehousesService(
        makePrisma({
          warehouseFindMany: jest
            .fn()
            .mockResolvedValue([
              { code: 'W1' },
              { code: 'W3' },
              { code: 'KATALOG' },
            ]),
          warehouseCreate,
        }),
      );

      await service.create({ name: 'New' });

      expect(
        firstArg<{ data: { code: string } }>(warehouseCreate).data.code,
      ).toBe('W4');
    });

    it('maps a duplicate code to 409', async () => {
      const service = new WarehousesService(
        makePrisma({
          warehouseCreate: jest.fn().mockRejectedValue(knownError('P2002')),
        }),
      );

      await expect(
        service.create({ name: 'X', code: 'W1' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('maps an unknown managerId (FK violation) to 400', async () => {
      const service = new WarehousesService(
        makePrisma({
          warehouseCreate: jest.fn().mockRejectedValue(knownError('P2003')),
        }),
      );

      await expect(
        service.create({ name: 'X', managerId: 'ghost' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('404s for an unknown id', async () => {
      const service = new WarehousesService(
        makePrisma({ warehouseFindUnique: jest.fn().mockResolvedValue(null) }),
      );
      await expect(service.findOne('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('adds a stock summary valued at the most specific cost available', async () => {
      const service = new WarehousesService(
        makePrisma({
          warehouseFindUnique: jest
            .fn()
            .mockResolvedValue({ id: 'w1', name: 'Main', manager: null }),
          inventoryFindMany: jest.fn().mockResolvedValue([
            {
              quantity: 10,
              averageCost: dec(5),
              product: { averageCost: dec(4), purchasePrice: dec(3) },
            },
            {
              quantity: 2,
              averageCost: null,
              product: { averageCost: null, purchasePrice: dec(7) },
            },
          ]),
        }),
      );

      const result = await service.findOne('w1');

      expect(result.stockSummary).toEqual({
        skuCount: 2,
        totalQuantity: 12,
        // 10 * 5 (inv avg) + 2 * 7 (product purchasePrice fallback)
        stockValue: 64,
      });
    });
  });

  describe('findAll', () => {
    it('filters by status when given', async () => {
      const warehouseFindMany = jest.fn().mockResolvedValue([]);
      const service = new WarehousesService(makePrisma({ warehouseFindMany }));

      await service.findAll({ status: WarehouseStatus.INACTIVE });

      expect(firstArg<{ where: unknown }>(warehouseFindMany).where).toEqual({
        status: WarehouseStatus.INACTIVE,
      });
    });
  });
});
