import { CustomersService } from './customers.service';
import { PrismaService } from '../prisma/prisma.service';

function makePrisma(overrides: { customer?: Record<string, unknown> } = {}) {
  return {
    customer: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      ...overrides.customer,
    },
  } as unknown as PrismaService;
}

describe('CustomersService.findOrCreateByPhone', () => {
  it('creates a new customer when no match exists', async () => {
    const create = jest
      .fn()
      .mockResolvedValue({ id: 'cus-1', phone: '998901234567', name: 'Shopper' });
    const prisma = makePrisma({ customer: { findMany: jest.fn().mockResolvedValue([]), create } });
    const service = new CustomersService(prisma);

    const result = await service.findOrCreateByPhone('998901234567', 'Shopper');

    expect(create).toHaveBeenCalledWith({
      data: { phone: '998901234567', name: 'Shopper' },
    });
    expect(result).toEqual({ id: 'cus-1', phone: '998901234567', name: 'Shopper' });
  });

  it('reuses an existing customer matched on canonical digits, regardless of formatting', async () => {
    const findMany = jest.fn().mockResolvedValue([
      { id: 'cus-1', phone: '+998 90 123-45-67', name: 'Existing' },
    ]);
    const create = jest.fn();
    const prisma = makePrisma({ customer: { findMany, create } });
    const service = new CustomersService(prisma);

    const result = await service.findOrCreateByPhone('998901234567');

    expect(create).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 'cus-1', phone: '+998 90 123-45-67', name: 'Existing' });
  });

  it('defaults the name to "Checkout" when none is given for a new customer', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'cus-2' });
    const prisma = makePrisma({ customer: { findMany: jest.fn().mockResolvedValue([]), create } });
    const service = new CustomersService(prisma);

    await service.findOrCreateByPhone('998901234567');

    expect(create).toHaveBeenCalledWith({
      data: { phone: '998901234567', name: 'Checkout' },
    });
  });
});
