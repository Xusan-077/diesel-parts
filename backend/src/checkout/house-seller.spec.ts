import { getOrCreateHouseSeller, HOUSE_SELLER_EMAIL } from './house-seller';
import { PrismaService } from '../prisma/prisma.service';

function makePrisma(overrides: { user?: Record<string, unknown> } = {}) {
  return {
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      ...overrides.user,
    },
  } as unknown as PrismaService;
}

describe('getOrCreateHouseSeller', () => {
  it('reuses the existing house user when one already exists', async () => {
    const findUnique = jest.fn().mockResolvedValue({ id: 'house-user-1' });
    const prisma = makePrisma({ user: { findUnique } });

    const houseSeller = await getOrCreateHouseSeller(prisma);

    expect(findUnique).toHaveBeenCalledWith({
      where: { email: HOUSE_SELLER_EMAIL },
      select: { id: true },
    });
    expect(houseSeller).toEqual({ id: 'house-user-1' });
  });

  it('creates the house user on first use — inactive, unloginable, and with no Seller profile', async () => {
    interface HouseUserCreateArgs {
      data: {
        email: string;
        role: string;
        isActive: boolean;
        passwordHash: string;
        seller?: unknown;
      };
      select: { id: boolean };
    }
    const create = jest
      .fn<Promise<{ id: string }>, [HouseUserCreateArgs]>()
      .mockResolvedValue({ id: 'house-user-1' });
    const prisma = makePrisma({
      user: { findUnique: jest.fn().mockResolvedValue(null), create },
    });

    const houseSeller = await getOrCreateHouseSeller(prisma);

    const callArgs = create.mock.calls[0][0];
    expect(callArgs.data.email).toBe(HOUSE_SELLER_EMAIL);
    expect(callArgs.data.role).toBe('SELLER');
    expect(callArgs.data.isActive).toBe(false);
    expect(typeof callArgs.data.passwordHash).toBe('string');
    // Order.sellerId is a FK to User — no Seller profile is attached.
    expect(callArgs.data.seller).toBeUndefined();
    expect(callArgs.select).toEqual({ id: true });
    expect(houseSeller).toEqual({ id: 'house-user-1' });
  });
});
