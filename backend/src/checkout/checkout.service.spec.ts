import { BadRequestException } from '@nestjs/common';
import { CheckoutService } from './checkout.service';
import { PrismaService } from '../prisma/prisma.service';
import { CartsService } from '../carts/carts.service';
import { CustomersService } from '../customers/customers.service';
import { OrdersService } from '../orders/orders.service';
import { Prisma } from '../../generated/prisma/client';

function makeDeps() {
  const getCart = jest.fn();
  const clear = jest.fn();
  const cartsService = { getCart, clear } as unknown as CartsService;

  const findOrCreateByPhone = jest.fn().mockResolvedValue({ id: 'cus-1' });
  const customersService = {
    findOrCreateByPhone,
  } as unknown as CustomersService;

  const reserveOrderNumber = jest.fn().mockResolvedValue('DP-1001');
  const ordersService = { reserveOrderNumber } as unknown as OrdersService;

  const productFindMany = jest.fn();
  const orderCreate = jest.fn<
    Promise<{ id: string; orderNumber: string; total: Prisma.Decimal }>,
    [
      {
        data: {
          orderNumber: string;
          customerId: string;
          sellerId: string;
          warehouseId: string | null;
          items: { create: Array<Record<string, unknown>> };
        };
      },
    ]
  >();
  const paymentCreate = jest.fn();
  const prisma = {
    product: { findMany: productFindMany },
    order: { create: orderCreate },
    user: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 'u1', seller: { id: 'house-1' } }),
    },
    payment: { create: paymentCreate },
    $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
  } as unknown as PrismaService;

  return {
    cartsService,
    customersService,
    ordersService,
    prisma,
    getCart,
    clear,
    findOrCreateByPhone,
    productFindMany,
    orderCreate,
  };
}

describe('CheckoutService.createOrder', () => {
  it('rejects an empty cart', async () => {
    const { cartsService, customersService, ordersService, prisma, getCart } =
      makeDeps();
    getCart.mockResolvedValue({ items: [] });
    const service = new CheckoutService(
      prisma,
      cartsService,
      customersService,
      ordersService,
    );

    await expect(
      service.createOrder('998901234567', { paymentMethod: 'ONLINE' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('builds an order from the cart, snapshotting price/sku/name, and clears the cart', async () => {
    const {
      cartsService,
      customersService,
      ordersService,
      prisma,
      getCart,
      clear,
      findOrCreateByPhone,
      productFindMany,
      orderCreate,
    } = makeDeps();
    getCart.mockResolvedValue({
      items: [{ productId: 'p1', quantity: 2 }],
    });
    productFindMany.mockResolvedValue([
      {
        id: 'p1',
        sku: 'SKU-1',
        nameEn: 'Filter',
        isActive: true,
        price: new Prisma.Decimal(100),
      },
    ]);
    orderCreate.mockResolvedValue({
      id: 'ord-1',
      orderNumber: 'DP-1001',
      total: new Prisma.Decimal(200),
    });

    const service = new CheckoutService(
      prisma,
      cartsService,
      customersService,
      ordersService,
    );
    const result = await service.createOrder('998901234567', {
      paymentMethod: 'ONLINE',
    });

    expect(findOrCreateByPhone).toHaveBeenCalledWith('998901234567');

    const callArgs = orderCreate.mock.calls[0][0];
    expect(callArgs.data.orderNumber).toBe('DP-1001');
    expect(callArgs.data.customerId).toBe('cus-1');
    expect(callArgs.data.sellerId).toBe('house-1');
    expect(callArgs.data.warehouseId).toBeNull();
    expect(callArgs.data.items.create).toHaveLength(1);
    expect(callArgs.data.items.create[0]).toMatchObject({
      productId: 'p1',
      productSku: 'SKU-1',
      productName: 'Filter',
      quantity: 2,
    });

    expect(clear).toHaveBeenCalledWith('998901234567');
    expect(result.order.id).toBe('ord-1');
  });

  it('rejects when a cart line references a retired or missing product', async () => {
    const {
      cartsService,
      customersService,
      ordersService,
      prisma,
      getCart,
      productFindMany,
    } = makeDeps();
    getCart.mockResolvedValue({
      items: [{ productId: 'p1', quantity: 1 }],
    });
    productFindMany.mockResolvedValue([]);

    const service = new CheckoutService(
      prisma,
      cartsService,
      customersService,
      ordersService,
    );

    await expect(
      service.createOrder('998901234567', { paymentMethod: 'ONLINE' }),
    ).rejects.toThrow(BadRequestException);
  });
});
