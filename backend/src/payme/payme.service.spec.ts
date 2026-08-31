import { PaymeService } from './payme.service';
import { PrismaService } from '../prisma/prisma.service';
import { PAYME_ERROR } from './payme-errors';
import { OrderPaymentStatus, Prisma } from '../../generated/prisma/client';

function makePrisma() {
  const orderFindUnique = jest.fn().mockResolvedValue(null);
  const orderUpdate = jest.fn<
    Promise<unknown>,
    [{ data: Record<string, unknown> }]
  >();
  const paymentFindFirst = jest.fn().mockResolvedValue(null);
  const paymentCreate = jest.fn<
    Promise<{ id: string; providerCreateTime: bigint }>,
    [{ data: Record<string, unknown> }]
  >();
  const paymentUpdate = jest.fn<
    Promise<{ id: string; paidAt?: Date; cancelledAt?: Date }>,
    [{ data: Record<string, unknown> }]
  >();
  const paymentAggregate = jest
    .fn()
    .mockResolvedValue({ _sum: { amount: null } });

  const prisma = {
    order: { findUnique: orderFindUnique, update: orderUpdate },
    payment: {
      findFirst: paymentFindFirst,
      create: paymentCreate,
      update: paymentUpdate,
      aggregate: paymentAggregate,
    },
    $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
  } as unknown as PrismaService;

  return {
    prisma,
    orderFindUnique,
    orderUpdate,
    paymentFindFirst,
    paymentCreate,
    paymentUpdate,
    paymentAggregate,
  };
}

const order = { id: 'ord-1', total: new Prisma.Decimal(500) };

// expect.any(String) itself types as `any`; cast once here so every
// `message: anyString` below satisfies @typescript-eslint/no-unsafe-assignment.
const anyString = expect.any(String) as unknown as string;

describe('PaymeService.checkPerformTransaction', () => {
  it('allows a matching order and amount', async () => {
    const { prisma, orderFindUnique } = makePrisma();
    orderFindUnique.mockResolvedValue(order);
    const service = new PaymeService(prisma);

    const response = await service.checkPerformTransaction({
      amount: 50000,
      account: { order_id: 'ord-1' },
    });

    expect(response).toEqual({ result: { allow: true } });
  });

  it('refuses an order that does not exist', async () => {
    const { prisma } = makePrisma();
    const service = new PaymeService(prisma);

    const response = await service.checkPerformTransaction({
      amount: 50000,
      account: { order_id: 'missing' },
    });

    expect(response).toEqual({
      error: { code: PAYME_ERROR.ACCOUNT_ERROR, message: anyString },
    });
  });

  it('refuses a mismatched amount', async () => {
    const { prisma, orderFindUnique } = makePrisma();
    orderFindUnique.mockResolvedValue(order);
    const service = new PaymeService(prisma);

    const response = await service.checkPerformTransaction({
      amount: 1,
      account: { order_id: 'ord-1' },
    });

    expect(response).toEqual({
      error: { code: PAYME_ERROR.INVALID_AMOUNT, message: anyString },
    });
  });
});

describe('PaymeService.createTransaction', () => {
  it('creates a new payment row and returns state 1', async () => {
    const { prisma, orderFindUnique, paymentFindFirst, paymentCreate } =
      makePrisma();
    orderFindUnique.mockResolvedValue(order);
    paymentFindFirst.mockResolvedValue(null);
    paymentCreate.mockResolvedValue({
      id: 'pay-1',
      providerCreateTime: BigInt(1700000000000),
    });
    const service = new PaymeService(prisma);

    const response = await service.createTransaction({
      id: 'txn-1',
      time: 1700000000000,
      amount: 50000,
      account: { order_id: 'ord-1' },
    });

    const callArgs = paymentCreate.mock.calls[0][0];
    expect(callArgs.data.orderId).toBe('ord-1');
    expect(callArgs.data.provider).toBe('payme');
    expect(callArgs.data.transactionId).toBe('txn-1');
    expect(callArgs.data.providerCreateTime).toBe(BigInt(1700000000000));
    expect(response).toEqual({
      result: { create_time: 1700000000000, transaction: 'pay-1', state: 1 },
    });
  });

  it('replays the same result for a repeated call on an existing PENDING transaction', async () => {
    const { prisma, orderFindUnique, paymentFindFirst, paymentCreate } =
      makePrisma();
    orderFindUnique.mockResolvedValue(order);
    paymentFindFirst.mockResolvedValue({
      id: 'pay-1',
      status: 'PENDING',
      providerCreateTime: BigInt(1700000000000),
    });
    const service = new PaymeService(prisma);

    const response = await service.createTransaction({
      id: 'txn-1',
      time: 999999999999, // different time than what was stored — must be ignored
      amount: 50000,
      account: { order_id: 'ord-1' },
    });

    expect(response).toEqual({
      result: { create_time: 1700000000000, transaction: 'pay-1', state: 1 },
    });
    expect(paymentCreate).not.toHaveBeenCalled();
  });
});

describe('PaymeService.performTransaction', () => {
  it('marks a PENDING payment COMPLETED and recomputes order.paymentStatus', async () => {
    const {
      prisma,
      orderFindUnique,
      orderUpdate,
      paymentFindFirst,
      paymentUpdate,
      paymentAggregate,
    } = makePrisma();
    orderFindUnique.mockResolvedValue(order);
    paymentFindFirst.mockResolvedValue({
      id: 'pay-1',
      orderId: 'ord-1',
      status: 'PENDING',
      providerCreateTime: BigInt(1700000000000),
    });
    paymentUpdate.mockResolvedValue({
      id: 'pay-1',
      paidAt: new Date(1700000005000),
    });
    paymentAggregate.mockResolvedValue({
      _sum: { amount: new Prisma.Decimal(500) },
    });
    const service = new PaymeService(prisma);

    const response = await service.performTransaction({ id: 'txn-1' });

    const updateArgs = paymentUpdate.mock.calls[0][0];
    expect(updateArgs.data.status).toBe('COMPLETED');
    const orderUpdateArgs = orderUpdate.mock.calls[0][0];
    expect(orderUpdateArgs.data.paymentStatus).toBe(OrderPaymentStatus.PAID);
    expect(response).toEqual({
      result: { transaction: 'pay-1', perform_time: 1700000005000, state: 2 },
    });
  });

  it('replays the same result for a repeated call on an already-COMPLETED transaction', async () => {
    const { prisma, paymentFindFirst, paymentUpdate } = makePrisma();
    paymentFindFirst.mockResolvedValue({
      id: 'pay-1',
      orderId: 'ord-1',
      status: 'COMPLETED',
      paidAt: new Date(1700000005000),
    });
    const service = new PaymeService(prisma);

    const response = await service.performTransaction({ id: 'txn-1' });

    expect(response).toEqual({
      result: { transaction: 'pay-1', perform_time: 1700000005000, state: 2 },
    });
    expect(paymentUpdate).not.toHaveBeenCalled();
  });

  it('refuses to perform a transaction that was already cancelled', async () => {
    const { prisma, paymentFindFirst } = makePrisma();
    paymentFindFirst.mockResolvedValue({
      id: 'pay-1',
      status: 'FAILED',
    });
    const service = new PaymeService(prisma);

    const response = await service.performTransaction({ id: 'txn-1' });

    expect(response).toEqual({
      error: { code: PAYME_ERROR.CANNOT_PERFORM, message: anyString },
    });
  });

  it('answers TRANSACTION_NOT_FOUND for an unknown id', async () => {
    const { prisma } = makePrisma();
    const service = new PaymeService(prisma);

    const response = await service.performTransaction({ id: 'nope' });

    expect(response).toEqual({
      error: {
        code: PAYME_ERROR.TRANSACTION_NOT_FOUND,
        message: anyString,
      },
    });
  });
});

describe('PaymeService.cancelTransaction', () => {
  it('cancels a PENDING payment to FAILED', async () => {
    const { prisma, paymentFindFirst, paymentUpdate, paymentAggregate } =
      makePrisma();
    paymentFindFirst.mockResolvedValue({
      id: 'pay-1',
      orderId: 'ord-1',
      status: 'PENDING',
    });
    paymentUpdate.mockResolvedValue({
      id: 'pay-1',
      cancelledAt: new Date(1700000009000),
    });
    paymentAggregate.mockResolvedValue({ _sum: { amount: null } });
    const service = new PaymeService(prisma);

    const response = await service.cancelTransaction({
      id: 'txn-1',
      reason: 3,
    });

    const updateArgs = paymentUpdate.mock.calls[0][0];
    expect(updateArgs.data.status).toBe('FAILED');
    expect(updateArgs.data.cancelReason).toBe(3);
    expect(response).toEqual({
      result: { transaction: 'pay-1', cancel_time: 1700000009000, state: -1 },
    });
  });

  it('cancels a COMPLETED payment to REFUNDED', async () => {
    const { prisma, paymentFindFirst, paymentUpdate, paymentAggregate } =
      makePrisma();
    paymentFindFirst.mockResolvedValue({
      id: 'pay-1',
      orderId: 'ord-1',
      status: 'COMPLETED',
    });
    paymentUpdate.mockResolvedValue({
      id: 'pay-1',
      cancelledAt: new Date(1700000009000),
    });
    paymentAggregate.mockResolvedValue({ _sum: { amount: null } });
    const service = new PaymeService(prisma);

    const response = await service.cancelTransaction({
      id: 'txn-1',
      reason: 5,
    });

    const updateArgs = paymentUpdate.mock.calls[0][0];
    expect(updateArgs.data.status).toBe('REFUNDED');
    expect(response).toEqual({
      result: { transaction: 'pay-1', cancel_time: 1700000009000, state: -2 },
    });
  });

  it('replays the same result for a repeated cancel on an already-cancelled transaction', async () => {
    const { prisma, paymentFindFirst, paymentUpdate } = makePrisma();
    paymentFindFirst.mockResolvedValue({
      id: 'pay-1',
      status: 'FAILED',
      cancelledAt: new Date(1700000009000),
    });
    const service = new PaymeService(prisma);

    const response = await service.cancelTransaction({
      id: 'txn-1',
      reason: 1,
    });

    expect(response).toEqual({
      result: { transaction: 'pay-1', cancel_time: 1700000009000, state: -1 },
    });
    expect(paymentUpdate).not.toHaveBeenCalled();
  });
});

describe('PaymeService.checkTransaction', () => {
  it('reports full state for an existing transaction', async () => {
    const { prisma, paymentFindFirst } = makePrisma();
    paymentFindFirst.mockResolvedValue({
      id: 'pay-1',
      status: 'COMPLETED',
      providerCreateTime: BigInt(1700000000000),
      paidAt: new Date(1700000005000),
      cancelledAt: null,
      cancelReason: null,
    });
    const service = new PaymeService(prisma);

    const response = await service.checkTransaction({ id: 'txn-1' });

    expect(response).toEqual({
      result: {
        create_time: 1700000000000,
        perform_time: 1700000005000,
        cancel_time: 0,
        transaction: 'pay-1',
        state: 2,
        reason: null,
      },
    });
  });

  it('answers TRANSACTION_NOT_FOUND for an unknown id', async () => {
    const { prisma } = makePrisma();
    const service = new PaymeService(prisma);

    const response = await service.checkTransaction({ id: 'nope' });

    expect(response).toEqual({
      error: {
        code: PAYME_ERROR.TRANSACTION_NOT_FOUND,
        message: anyString,
      },
    });
  });
});
