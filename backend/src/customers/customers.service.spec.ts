import { CustomersService } from './customers.service';
import { PrismaService } from '../prisma/prisma.service';

function makePrisma(overrides: { customer?: Record<string, unknown> } = {}) {
  return {
    customer: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
      ...overrides.customer,
    },
  } as unknown as PrismaService;
}

describe('CustomersService.findOrCreateByPhone', () => {
  it('creates a new customer with every detail given', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'cus-1',
      phone: '998901234567',
      name: 'Aziz Karimov',
    });
    const prisma = makePrisma({
      customer: { findMany: jest.fn().mockResolvedValue([]), create },
    });
    const service = new CustomersService(prisma);

    const result = await service.findOrCreateByPhone('998901234567', {
      name: 'Aziz Karimov',
      email: 'aziz@example.com',
      company: 'Aziz LLC',
      taxId: '123456789',
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        phone: '998901234567',
        name: 'Aziz Karimov',
        email: 'aziz@example.com',
        company: 'Aziz LLC',
        taxId: '123456789',
      },
    });
    expect(result).toEqual({
      id: 'cus-1',
      phone: '998901234567',
      name: 'Aziz Karimov',
    });
  });

  it('defaults the name to "Checkout" when none is given for a new customer', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'cus-2' });
    const prisma = makePrisma({
      customer: { findMany: jest.fn().mockResolvedValue([]), create },
    });
    const service = new CustomersService(prisma);

    await service.findOrCreateByPhone('998901234567');

    expect(create).toHaveBeenCalledWith({
      data: {
        phone: '998901234567',
        name: 'Checkout',
        email: undefined,
        company: undefined,
        taxId: undefined,
      },
    });
  });

  it('reuses an existing customer matched on canonical digits, and touches nothing when nothing changed', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'cus-1',
        phone: '+998 90 123-45-67',
        name: 'Existing',
        email: 'e@x.com',
        company: 'X',
        taxId: '1',
      },
    ]);
    const update = jest.fn();
    const prisma = makePrisma({ customer: { findMany, update } });
    const service = new CustomersService(prisma);

    const result = await service.findOrCreateByPhone('998901234567', {
      name: 'Existing',
      email: 'e@x.com',
      company: 'X',
      taxId: '1',
    });

    expect(update).not.toHaveBeenCalled();
    expect(result.id).toBe('cus-1');
  });

  it('overwrites the name on an existing customer when it differs', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'cus-1',
        phone: '998901234567',
        name: 'Checkout',
        email: null,
        company: null,
        taxId: null,
      },
    ]);
    const update = jest
      .fn()
      .mockResolvedValue({ id: 'cus-1', name: 'Aziz Karimov' });
    const prisma = makePrisma({ customer: { findMany, update } });
    const service = new CustomersService(prisma);

    await service.findOrCreateByPhone('998901234567', { name: 'Aziz Karimov' });

    expect(update).toHaveBeenCalledWith({
      where: { id: 'cus-1' },
      data: { name: 'Aziz Karimov' },
    });
  });

  it('backfills email/company/taxId only when the existing column is null', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'cus-1',
        phone: '998901234567',
        name: 'Aziz',
        email: null,
        company: 'Old LLC',
        taxId: null,
      },
    ]);
    const update = jest.fn().mockResolvedValue({ id: 'cus-1' });
    const prisma = makePrisma({ customer: { findMany, update } });
    const service = new CustomersService(prisma);

    await service.findOrCreateByPhone('998901234567', {
      name: 'Aziz',
      email: 'aziz@example.com',
      company: 'New LLC',
      taxId: '999',
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: 'cus-1' },
      data: { email: 'aziz@example.com', taxId: '999' },
    });
  });
});
