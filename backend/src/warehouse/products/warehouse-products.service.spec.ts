import { NotFoundException } from '@nestjs/common';
import { WarehouseProductsService } from './warehouse-products.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductsService } from '../../products/products.service';
import { Prisma, StockMovementType } from '../../../generated/prisma/client';
import { StockStatus } from '../../products/stock-status';

function firstArg<T>(mock: jest.Mock): T {
  const calls = mock.mock.calls as unknown[][];
  return calls[0][0] as T;
}

function makePrisma(mocks: {
  productFindMany?: jest.Mock;
  productFindUnique?: jest.Mock;
  movementFindMany?: jest.Mock;
  movementCount?: jest.Mock;
}) {
  return {
    product: {
      findMany: mocks.productFindMany ?? jest.fn().mockResolvedValue([]),
      findUnique: mocks.productFindUnique ?? jest.fn().mockResolvedValue(null),
    },
    stockMovement: {
      findMany: mocks.movementFindMany ?? jest.fn().mockResolvedValue([]),
      count: mocks.movementCount ?? jest.fn().mockResolvedValue(0),
    },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  } as unknown as PrismaService;
}

function makeProducts() {
  return {
    create: jest.fn().mockResolvedValue({ id: 'p-new' }),
    update: jest.fn().mockResolvedValue({ id: 'p-1' }),
  } as unknown as ProductsService;
}

const dec = (n: number) => new Prisma.Decimal(n);

function productRow(over: Record<string, unknown> = {}) {
  return {
    id: 'p-1',
    sku: 'SKU-1',
    nameUz: 'Nasos',
    barcode: '4600000000001',
    minStock: 5,
    purchasePrice: dec(10),
    averageCost: dec(12),
    lastPurchaseCost: dec(13),
    stockStatus: 'available',
    category: { id: 'c1', nameUz: 'Kat', nameRu: 'Kat', nameEn: 'Cat' },
    brand: { id: 'b1', name: 'Bosch' },
    inventories: [
      {
        warehouseId: 'w1',
        quantity: 8,
        reservedQuantity: 1,
        averageCost: dec(12),
      },
      {
        warehouseId: 'w2',
        quantity: 2,
        reservedQuantity: 0,
        averageCost: null,
      },
    ],
    ...over,
  };
}

interface ListArgs {
  where: { OR: Record<string, { has?: string }>[] };
  include: { inventories: { where?: { warehouseId: string } } };
}

describe('WarehouseProductsService', () => {
  describe('list', () => {
    it('searches name / sku / barcode / oem and returns pagination meta', async () => {
      const productFindMany = jest.fn().mockResolvedValue([productRow()]);
      const service = new WarehouseProductsService(
        makePrisma({ productFindMany }),
        makeProducts(),
      );

      const result = await service.list({ q: 'abc123', page: 1, limit: 20 });

      const { where } = firstArg<ListArgs>(productFindMany);
      const fields = where.OR.flatMap((clause) => Object.keys(clause));
      expect(fields).toEqual(
        expect.arrayContaining(['nameUz', 'sku', 'barcode', 'oemNumbers']),
      );
      const oemClause = where.OR.find((clause) => clause.oemNumbers);
      expect(oemClause?.oemNumbers?.has).toBe('ABC123');

      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });

    it('sums stock across warehouses and values it (per-warehouse cost, then fallback)', async () => {
      const service = new WarehouseProductsService(
        makePrisma({
          productFindMany: jest.fn().mockResolvedValue([productRow()]),
        }),
        makeProducts(),
      );

      const [row] = (await service.list({})).data;

      expect(row.quantity).toBe(10);
      expect(row.reservedQuantity).toBe(1);
      expect(row.availableQuantity).toBe(9);
      expect(row.stockStatus).toBe(StockStatus.IN_STOCK);
      // w1: 8 * 12 (own avg) + w2: 2 * 12 (product avg fallback) = 120
      expect(row.stockValue).toBe(120);
    });

    it('scopes the inventory include to one warehouse when warehouseId is given', async () => {
      const productFindMany = jest.fn().mockResolvedValue([]);
      const service = new WarehouseProductsService(
        makePrisma({ productFindMany }),
        makeProducts(),
      );

      await service.list({ warehouseId: 'w1' });

      const { include } = firstArg<ListArgs>(productFindMany);
      expect(include.inventories.where).toEqual({ warehouseId: 'w1' });
    });

    it('filters by derived stock status', async () => {
      const service = new WarehouseProductsService(
        makePrisma({
          productFindMany: jest.fn().mockResolvedValue([
            productRow(),
            productRow({
              id: 'p-2',
              inventories: [
                {
                  warehouseId: 'w1',
                  quantity: 0,
                  reservedQuantity: 0,
                  averageCost: null,
                },
              ],
            }),
          ]),
        }),
        makeProducts(),
      );

      const result = await service.list({ status: StockStatus.OUT_OF_STOCK });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('p-2');
    });
  });

  describe('create / update', () => {
    it('delegates writes to ProductsService with the actor id', async () => {
      const products = makeProducts();
      const service = new WarehouseProductsService(makePrisma({}), products);

      await service.create({ sku: 'S' } as never, 'actor-1');
      await service.update('p-1', { sku: 'S2' }, 'actor-1');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(products.create).toHaveBeenCalledWith({ sku: 'S' }, 'actor-1');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(products.update).toHaveBeenCalledWith(
        'p-1',
        { sku: 'S2' },
        'actor-1',
      );
    });
  });

  describe('movements', () => {
    it('404s when the product does not exist', async () => {
      const service = new WarehouseProductsService(
        makePrisma({ productFindUnique: jest.fn().mockResolvedValue(null) }),
        makeProducts(),
      );

      await expect(service.movements('missing', {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns ledger rows carrying balanceAfter, newest first', async () => {
      const movementFindMany = jest.fn().mockResolvedValue([
        {
          id: 'm-1',
          type: StockMovementType.PURCHASE,
          quantity: 5,
          balanceAfter: 15,
          unitCost: dec(9),
          reason: null,
          referenceType: 'GoodsReceipt',
          referenceId: 'gr-1',
          warehouseId: 'w1',
          inventory: {
            warehouseId: 'w1',
            warehouse: { id: 'w1', name: 'Main', code: 'W1' },
          },
          createdBy: { id: 'u1', name: 'Ali' },
          createdAt: new Date('2026-09-07T10:00:00Z'),
        },
      ]);
      const service = new WarehouseProductsService(
        makePrisma({
          productFindUnique: jest.fn().mockResolvedValue({ id: 'p-1' }),
          movementFindMany,
          movementCount: jest.fn().mockResolvedValue(1),
        }),
        makeProducts(),
      );

      const result = await service.movements('p-1', {
        type: StockMovementType.PURCHASE,
      });

      expect(firstArg<{ orderBy: unknown }>(movementFindMany).orderBy).toEqual({
        createdAt: 'desc',
      });
      expect(result.data[0]).toMatchObject({
        id: 'm-1',
        balanceAfter: 15,
        unitCost: 9,
        warehouseCode: 'W1',
        referenceId: 'gr-1',
      });
      expect(result.meta.total).toBe(1);
    });
  });
});
