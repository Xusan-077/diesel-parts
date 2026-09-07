import { WarehouseReportsService } from './warehouse-reports.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, StockMovementType } from '../../../generated/prisma/client';
import { StockStatus } from '../../products/stock-status';

function firstArg<T>(mock: jest.Mock): T {
  const calls = mock.mock.calls as unknown[][];
  return calls[0][0] as T;
}

const dec = (n: number) => new Prisma.Decimal(n);

function makePrisma(mocks: {
  inventoryFindMany?: jest.Mock;
  movementFindMany?: jest.Mock;
  movementCount?: jest.Mock;
}) {
  return {
    inventory: {
      findMany: mocks.inventoryFindMany ?? jest.fn().mockResolvedValue([]),
    },
    stockMovement: {
      findMany: mocks.movementFindMany ?? jest.fn().mockResolvedValue([]),
      count: mocks.movementCount ?? jest.fn().mockResolvedValue(0),
    },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  } as unknown as PrismaService;
}

const wh = (id: string) => ({ id, name: `WH ${id}`, code: id.toUpperCase() });

describe('WarehouseReportsService', () => {
  describe('stock', () => {
    it('groups by warehouse and values stock at the most specific cost', async () => {
      const service = new WarehouseReportsService(
        makePrisma({
          inventoryFindMany: jest.fn().mockResolvedValue([
            {
              quantity: 10,
              reservedQuantity: 2,
              averageCost: dec(5),
              warehouse: wh('w1'),
              product: { averageCost: dec(4), purchasePrice: dec(3) },
            },
            {
              quantity: 4,
              reservedQuantity: 0,
              averageCost: null,
              warehouse: wh('w1'),
              product: { averageCost: dec(7), purchasePrice: dec(6) },
            },
            {
              quantity: 5,
              reservedQuantity: 1,
              averageCost: null,
              warehouse: wh('w2'),
              product: { averageCost: null, purchasePrice: dec(2) },
            },
          ]),
        }),
      );

      const result = await service.stock({});

      const w1 = result.data.find((row) => row.warehouseId === 'w1')!;
      // 10 * 5 (inv avg) + 4 * 7 (product avg) = 78
      expect(w1.stockValue).toBe(78);
      expect(w1.skuCount).toBe(2);
      expect(w1.quantity).toBe(14);

      // w2: 5 * 2 (purchasePrice fallback) = 10
      expect(result.totals.stockValue).toBe(88);
      expect(result.totals.skuCount).toBe(3);
    });
  });

  describe('lowStock', () => {
    it('keeps only rows at or below minStock and reports the shortfall', async () => {
      const service = new WarehouseReportsService(
        makePrisma({
          inventoryFindMany: jest.fn().mockResolvedValue([
            {
              quantity: 3,
              reservedQuantity: 1, // available 2 <= minStock 5 -> flagged
              averageCost: dec(10),
              warehouse: wh('w1'),
              product: {
                id: 'p-low',
                sku: 'LOW',
                nameUz: 'Kam',
                unit: 'dona',
                minStock: 5,
                recommendedStock: 12,
                averageCost: dec(10),
                purchasePrice: dec(9),
              },
            },
            {
              quantity: 40,
              reservedQuantity: 0, // available 40 > minStock 5 -> kept out
              averageCost: dec(1),
              warehouse: wh('w1'),
              product: {
                id: 'p-ok',
                sku: 'OK',
                nameUz: 'Yetarli',
                unit: 'dona',
                minStock: 5,
                recommendedStock: 10,
                averageCost: dec(1),
                purchasePrice: dec(1),
              },
            },
          ]),
        }),
      );

      const result = await service.lowStock({});

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        productId: 'p-low',
        availableQuantity: 2,
        shortBy: 10,
        status: StockStatus.LOW_STOCK,
        stockValue: 30,
      });
    });
  });

  describe('movements', () => {
    it('builds the date + type + scope filter and paginates', async () => {
      const movementFindMany = jest.fn().mockResolvedValue([]);
      const service = new WarehouseReportsService(
        makePrisma({
          movementFindMany,
          movementCount: jest.fn().mockResolvedValue(0),
        }),
      );

      await service.movements({
        type: StockMovementType.PURCHASE,
        warehouseId: 'w1',
        productId: 'p1',
        dateFrom: '2026-09-01T00:00:00.000Z',
        dateTo: '2026-09-07T00:00:00.000Z',
        page: 2,
        limit: 10,
      });

      const args = firstArg<{
        where: {
          type: string;
          inventory: { warehouseId: string; productId: string };
          createdAt: { gte: Date; lte: Date };
        };
        skip: number;
        take: number;
      }>(movementFindMany);
      expect(args.where.type).toBe(StockMovementType.PURCHASE);
      expect(args.where.inventory).toEqual({
        warehouseId: 'w1',
        productId: 'p1',
      });
      expect(args.where.createdAt.gte).toEqual(
        new Date('2026-09-01T00:00:00.000Z'),
      );
      expect(args.skip).toBe(10);
      expect(args.take).toBe(10);
    });
  });
});
