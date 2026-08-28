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
  it('reuses the existing house account when one already exists', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: 'user-1',
      seller: { id: 'seller-1' },
    });
    const prisma = makePrisma({ user: { findUnique } });

    const seller = await getOrCreateHouseSeller(prisma);

    expect(findUnique).toHaveBeenCalledWith({
      where: { email: HOUSE_SELLER_EMAIL },
      include: { seller: true },
    });
    expect(seller).toEqual({ id: 'seller-1' });
  });

  it('creates the house user+seller pair on first use, inactive and unloginable', async () => {
    interface HouseUserCreateArgs {
      data: {
        email: string;
        role: string;
        isActive: boolean;
        seller: { create: Record<string, never> };
        passwordHash: string;
      };
      include: { seller: boolean };
    }
    const create = jest
      .fn<
        Promise<{ id: string; seller: { id: string } }>,
        [HouseUserCreateArgs]
      >()
      .mockResolvedValue({
        id: 'user-1',
        seller: { id: 'seller-1' },
      });
    const prisma = makePrisma({
      user: { findUnique: jest.fn().mockResolvedValue(null), create },
    });

    const seller = await getOrCreateHouseSeller(prisma);

    const callArgs = create.mock.calls[0][0];
    expect(callArgs.data.email).toBe(HOUSE_SELLER_EMAIL);
    expect(callArgs.data.role).toBe('SELLER');
    expect(callArgs.data.isActive).toBe(false);
    expect(callArgs.data.seller).toEqual({ create: {} });
    expect(typeof callArgs.data.passwordHash).toBe('string');
    expect(callArgs.include).toEqual({ seller: true });
    expect(seller).toEqual({ id: 'seller-1' });
  });
});
