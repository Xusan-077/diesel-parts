import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GoodsReceiptsService } from './goods-receipts.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import {
  AuditAction,
  GoodsReceiptStatus,
  Prisma,
  StockMovementType,
} from '../../../generated/prisma/client';

function firstArg<T>(mock: jest.Mock): T {
  const calls = mock.mock.calls as unknown[][];
  return calls[0][0] as T;
}

const dec = (n: number) => new Prisma.Decimal(n);

interface TxState {
  productIds: string[];
  warehouse: { id: string } | null;
  sequenceLast: number;
  inventory: Record<
    string,
    { id: string; quantity: number; averageCost: Prisma.Decimal | null }
  >;
}

function makeTx(state: TxState) {
  const inventoryCreate = jest.fn((args: { data: Record<string, unknown> }) => {
    const row = {
      id: `inv-${Object.keys(state.inventory).length + 1}`,
      quantity: args.data.quantity as number,
      averageCost: args.data.averageCost as Prisma.Decimal,
    };
    state.inventory[args.data.productId as string] = row;
    return Promise.resolve(row);
  });
  const inventoryUpdate = jest.fn(
    (args: { where: { id: string }; data: Record<string, unknown> }) => {
      const row = Object.values(state.inventory).find(
        (r) => r.id === args.where.id,
      )!;
      row.quantity = args.data.quantity as number;
      row.averageCost = args.data.averageCost as Prisma.Decimal;
      return Promise.resolve(row);
    },
  );

  return {
    warehouse: {
      findUnique: jest.fn().mockResolvedValue(state.warehouse),
    },
    product: {
      findMany: jest.fn((args: { where: { id: { in: string[] } } }) =>
        Promise.resolve(
          args.where.id.in
            .filter((id) => state.productIds.includes(id))
            .map((id) => ({ id })),
        ),
      ),
      update: jest.fn().mockResolvedValue({}),
    },
    goodsReceiptSequence: {
      upsert: jest.fn(() => {
        state.sequenceLast += 1;
        return Promise.resolve({ id: 1, lastNumber: state.sequenceLast });
      }),
    },
    goodsReceipt: {
      create: jest.fn((args: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'gr-1', ...args.data }),
      ),
      findUnique: jest.fn(),
      update: jest.fn((args: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'gr-1', ...args.data }),
      ),
    },
    goodsReceiptItem: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    inventory: {
      findUnique: jest.fn(
        (args: { where: { productId_warehouseId: { productId: string } } }) =>
          Promise.resolve(
            state.inventory[args.where.productId_warehouseId.productId] ?? null,
          ),
      ),
      findMany: jest.fn((args: { where: { productId: string } }) =>
        Promise.resolve(
          state.inventory[args.where.productId]
            ? [state.inventory[args.where.productId]]
            : [],
        ),
      ),
      create: inventoryCreate,
      update: inventoryUpdate,
    },
    stockMovement: {
      create: jest.fn().mockResolvedValue({}),
    },
  };
}

function makePrisma(tx: ReturnType<typeof makeTx>) {
  return {
    $transaction: jest.fn((arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (t: unknown) => unknown)(tx)
        : Promise.all(arg as Promise<unknown>[]),
    ),
    goodsReceipt: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      update: tx.goodsReceipt.update,
    },
  } as unknown as PrismaService;
}

function makeAudit() {
  const record = jest.fn().mockResolvedValue(undefined);
  return { audit: { record } as unknown as AuditService, record };
}

function baseState(over: Partial<TxState> = {}): TxState {
  return {
    productIds: ['p-1', 'p-2'],
    warehouse: { id: 'w-1' },
    sequenceLast: 0,
    inventory: {},
    ...over,
  };
}

describe('GoodsReceiptsService', () => {
  describe('create', () => {
    it('computes subtotal/total server-side and assigns GR-<year>-0001', async () => {
      const tx = makeTx(baseState());
      const prisma = makePrisma(tx);
      const { audit, record } = makeAudit();
      const service = new GoodsReceiptsService(prisma, audit);

      const result = await service.create(
        {
          warehouseId: 'w-1',
          discount: 10,
          tax: 5,
          items: [
            { productId: 'p-1', quantity: 3, unitCost: 100 },
            { productId: 'p-2', quantity: 2, unitCost: 50 },
          ],
        },
        'actor-1',
        '10.0.0.5',
      );

      const data = firstArg<{ data: Record<string, unknown> }>(
        tx.goodsReceipt.create,
      ).data;
      // subtotal = 3*100 + 2*50 = 400; total = 400 - 10 + 5 = 395
      expect(Number(data.subtotal as Prisma.Decimal)).toBe(400);
      expect(Number(data.total as Prisma.Decimal)).toBe(395);
      expect(data.receiptNumber).toMatch(/^GR-\d{4}-0001$/);
      expect(data.status).toBe(GoodsReceiptStatus.DRAFT);

      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.CREATE,
          entityType: 'GoodsReceipt',
          ipAddress: '10.0.0.5',
        }),
      );
      expect(result.id).toBe('gr-1');
    });

    it('rejects a line pointing at a missing product (no receipt written)', async () => {
      const tx = makeTx(baseState({ productIds: ['p-1'] }));
      const service = new GoodsReceiptsService(
        makePrisma(tx),
        makeAudit().audit,
      );

      await expect(
        service.create(
          {
            warehouseId: 'w-1',
            items: [{ productId: 'ghost', quantity: 1, unitCost: 1 }],
          },
          'actor-1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tx.goodsReceipt.create).not.toHaveBeenCalled();
    });
  });

  describe('approve', () => {
    function approveState() {
      const state = baseState();
      const tx = makeTx(state);
      const prisma = makePrisma(tx);
      (prisma.$transaction as jest.Mock).mockImplementation((arg: unknown) =>
        (arg as (t: unknown) => unknown)(tx),
      );
      tx.goodsReceipt.findUnique = jest.fn().mockResolvedValue({
        id: 'gr-1',
        status: GoodsReceiptStatus.DRAFT,
        warehouseId: 'w-1',
        receiptNumber: 'GR-2026-0001',
        subtotal: dec(400),
        discount: dec(0),
        tax: dec(0),
        total: dec(400),
        supplierName: null,
        items: [
          { productId: 'p-1', quantity: 4, unitCost: dec(100) },
          { productId: 'p-2', quantity: 2, unitCost: dec(50) },
        ],
      });
      return { state, tx, prisma };
    }

    it('creates one PURCHASE movement per line with balanceAfter, rolls up costs, writes audit', async () => {
      const { tx, prisma } = approveState();
      const { audit, record } = makeAudit();
      const service = new GoodsReceiptsService(prisma, audit);

      await service.approve('gr-1', 'actor-1', '10.0.0.9');

      expect(tx.stockMovement.create).toHaveBeenCalledTimes(2);
      const firstMovement = firstArg<{ data: Record<string, unknown> }>(
        tx.stockMovement.create,
      ).data;
      expect(firstMovement.type).toBe(StockMovementType.PURCHASE);
      expect(firstMovement.balanceAfter).toBe(4);
      expect(firstMovement.referenceType).toBe('GoodsReceipt');
      expect(firstMovement.warehouseId).toBe('w-1');

      // New inventory rows created at unit cost, product cost rolled up.
      expect(tx.inventory.create).toHaveBeenCalledTimes(2);
      expect(tx.product.update).toHaveBeenCalledTimes(2);

      const updateArg = firstArg<{ data: Record<string, unknown> }>(
        tx.goodsReceipt.update,
      );
      expect(updateArg.data.status).toBe(GoodsReceiptStatus.APPROVED);
      expect(updateArg.data.approvedById).toBe('actor-1');
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.APPROVE }),
      );
    });

    it('weighted-averages onto an existing inventory row', async () => {
      const { state, tx, prisma } = approveState();
      state.inventory['p-1'] = {
        id: 'inv-existing',
        quantity: 6,
        averageCost: dec(90),
      };
      const service = new GoodsReceiptsService(prisma, makeAudit().audit);

      await service.approve('gr-1', 'actor-1');

      // old 6 @ 90 (540) + new 4 @ 100 (400) => 10 units, 940 value => 94
      const update = firstArg<{
        data: { quantity: number; averageCost: Prisma.Decimal };
      }>(tx.inventory.update);
      expect(update.data.quantity).toBe(10);
      expect(Number(update.data.averageCost)).toBeCloseTo(94);
    });

    it('refuses a second approve (status already APPROVED) → 400', async () => {
      const { tx, prisma } = approveState();
      tx.goodsReceipt.findUnique = jest.fn().mockResolvedValue({
        id: 'gr-1',
        status: GoodsReceiptStatus.APPROVED,
        items: [],
      });
      const service = new GoodsReceiptsService(prisma, makeAudit().audit);

      await expect(service.approve('gr-1', 'actor-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(tx.stockMovement.create).not.toHaveBeenCalled();
    });

    it('404s an unknown receipt', async () => {
      const { tx, prisma } = approveState();
      tx.goodsReceipt.findUnique = jest.fn().mockResolvedValue(null);
      const service = new GoodsReceiptsService(prisma, makeAudit().audit);

      await expect(
        service.approve('missing', 'actor-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('cancel', () => {
    it('only from DRAFT', async () => {
      const tx = makeTx(baseState());
      const prisma = makePrisma(tx);
      (prisma.goodsReceipt.findUnique as jest.Mock).mockResolvedValue({
        id: 'gr-1',
        status: GoodsReceiptStatus.APPROVED,
        items: [],
        receiptNumber: 'GR-2026-0001',
        warehouseId: 'w-1',
        subtotal: dec(0),
        discount: dec(0),
        tax: dec(0),
        total: dec(0),
        supplierName: null,
      });
      const service = new GoodsReceiptsService(prisma, makeAudit().audit);

      await expect(service.cancel('gr-1', 'actor-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('DRAFT → CANCELLED with a REJECT audit row, no hard delete', async () => {
      const tx = makeTx(baseState());
      const prisma = makePrisma(tx);
      (prisma.goodsReceipt.findUnique as jest.Mock).mockResolvedValue({
        id: 'gr-1',
        status: GoodsReceiptStatus.DRAFT,
        items: [],
        receiptNumber: 'GR-2026-0001',
        warehouseId: 'w-1',
        subtotal: dec(0),
        discount: dec(0),
        tax: dec(0),
        total: dec(0),
        supplierName: null,
      });
      const { audit, record } = makeAudit();
      const service = new GoodsReceiptsService(prisma, audit);

      await service.cancel('gr-1', 'actor-1');

      const updateArg = firstArg<{ data: Record<string, unknown> }>(
        tx.goodsReceipt.update,
      );
      expect(updateArg.data.status).toBe(GoodsReceiptStatus.CANCELLED);
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.REJECT }),
      );
    });
  });
});
