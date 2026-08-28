import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CheckoutService } from './checkout.service';
import { PrismaService } from '../prisma/prisma.service';
import { CartsService } from '../carts/carts.service';
import { CustomersService } from '../customers/customers.service';
import { OrdersService } from '../orders/orders.service';
import { Prisma } from '../../generated/prisma/client';
import type { CreateCheckoutDto } from './dto/create-checkout.dto';

function baseDto(
  overrides: Partial<CreateCheckoutDto> = {},
): CreateCheckoutDto {
  return {
    firstName: 'Aziz',
    lastName: 'Karimov',
    deliveryMethod: 'PICKUP',
    termsAccepted: true,
    paymentMethod: 'ONLINE',
    ...overrides,
  };
}

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
          deliveryMethod: string;
          deliveryCity: string | null;
          deliveryDistrict: string | null;
          deliveryStreet: string | null;
          deliveryNotes: string | null;
          items: { create: Array<Record<string, unknown>> };
        };
      },
    ]
  >();
  const orderFindUnique = jest.fn();
  const paymentCreate = jest.fn();
  const prisma = {
    product: { findMany: productFindMany },
    order: { create: orderCreate, findUnique: orderFindUnique },
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
    orderFindUnique,
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
      service.createOrder('998901234567', baseDto()),
    ).rejects.toThrow(BadRequestException);
  });

  it('builds a PICKUP order, snapshotting price/sku/name, and resolves the customer by name/email/company/taxId', async () => {
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
    const result = await service.createOrder(
      '998901234567',
      baseDto({
        email: 'aziz@example.com',
        companyName: 'Aziz LLC',
        taxId: '123',
      }),
    );

    expect(findOrCreateByPhone).toHaveBeenCalledWith('998901234567', {
      name: 'Aziz Karimov',
      email: 'aziz@example.com',
      company: 'Aziz LLC',
      taxId: '123',
    });

    const callArgs = orderCreate.mock.calls[0][0];
    expect(callArgs.data.orderNumber).toBe('DP-1001');
    expect(callArgs.data.customerId).toBe('cus-1');
    expect(callArgs.data.sellerId).toBe('house-1');
    expect(callArgs.data.warehouseId).toBeNull();
    expect(callArgs.data.deliveryMethod).toBe('PICKUP');
    expect(callArgs.data.deliveryCity).toBeNull();
    expect(callArgs.data.deliveryDistrict).toBeNull();
    expect(callArgs.data.deliveryStreet).toBeNull();
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

  it('stores the structured address for a DELIVERY order', async () => {
    const {
      cartsService,
      customersService,
      ordersService,
      prisma,
      getCart,
      productFindMany,
      orderCreate,
    } = makeDeps();
    getCart.mockResolvedValue({ items: [{ productId: 'p1', quantity: 1 }] });
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
      total: new Prisma.Decimal(100),
    });

    const service = new CheckoutService(
      prisma,
      cartsService,
      customersService,
      ordersService,
    );
    await service.createOrder(
      '998901234567',
      baseDto({
        deliveryMethod: 'DELIVERY',
        city: 'Toshkent',
        district: 'Chilonzor',
        street: 'Bunyodkor 12',
        deliveryNotes: '3-qavat',
      }),
    );

    const callArgs = orderCreate.mock.calls[0][0];
    expect(callArgs.data.deliveryMethod).toBe('DELIVERY');
    expect(callArgs.data.deliveryCity).toBe('Toshkent');
    expect(callArgs.data.deliveryDistrict).toBe('Chilonzor');
    expect(callArgs.data.deliveryStreet).toBe('Bunyodkor 12');
    expect(callArgs.data.deliveryNotes).toBe('3-qavat');
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
      service.createOrder('998901234567', baseDto()),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('CheckoutService.getOrderStatus', () => {
  it("returns the caller's own order status, including the latest payment", async () => {
    const {
      cartsService,
      customersService,
      ordersService,
      prisma,
      orderFindUnique,
    } = makeDeps();
    orderFindUnique.mockResolvedValue({
      orderNumber: 'DP-1001',
      status: 'NEW',
      paymentStatus: 'UNPAID',
      customer: { phone: '+998 90 123-45-67' },
      payments: [{ status: 'PENDING' }],
    });
    const service = new CheckoutService(
      prisma,
      cartsService,
      customersService,
      ordersService,
    );

    const result = await service.getOrderStatus('998901234567', 'ord-1');

    expect(result).toEqual({
      orderNumber: 'DP-1001',
      status: 'NEW',
      paymentStatus: 'UNPAID',
      latestPaymentStatus: 'PENDING',
    });
  });

  it('answers null latestPaymentStatus when the order has no payment yet', async () => {
    const {
      cartsService,
      customersService,
      ordersService,
      prisma,
      orderFindUnique,
    } = makeDeps();
    orderFindUnique.mockResolvedValue({
      orderNumber: 'DP-1001',
      status: 'DRAFT',
      paymentStatus: 'UNPAID',
      customer: { phone: '998901234567' },
      payments: [],
    });
    const service = new CheckoutService(
      prisma,
      cartsService,
      customersService,
      ordersService,
    );

    const result = await service.getOrderStatus('998901234567', 'ord-1');

    expect(result.latestPaymentStatus).toBeNull();
  });

  it('throws NotFoundException for an order that does not exist', async () => {
    const {
      cartsService,
      customersService,
      ordersService,
      prisma,
      orderFindUnique,
    } = makeDeps();
    orderFindUnique.mockResolvedValue(null);
    const service = new CheckoutService(
      prisma,
      cartsService,
      customersService,
      ordersService,
    );

    await expect(
      service.getOrderStatus('998901234567', 'missing'),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when the order belongs to a different phone', async () => {
    const {
      cartsService,
      customersService,
      ordersService,
      prisma,
      orderFindUnique,
    } = makeDeps();
    orderFindUnique.mockResolvedValue({
      orderNumber: 'DP-1001',
      status: 'NEW',
      paymentStatus: 'UNPAID',
      customer: { phone: '998911111111' },
      payments: [],
    });
    const service = new CheckoutService(
      prisma,
      cartsService,
      customersService,
      ordersService,
    );

    await expect(
      service.getOrderStatus('998901234567', 'ord-1'),
    ).rejects.toThrow(NotFoundException);
  });
});
