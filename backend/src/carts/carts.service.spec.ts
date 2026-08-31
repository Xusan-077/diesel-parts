import { CartsService } from './carts.service';
import { PrismaService } from '../prisma/prisma.service';

function makePrisma(
  overrides: {
    cart?: Record<string, unknown>;
    cartItem?: Record<string, unknown>;
  } = {},
) {
  return {
    cart: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn(),
      ...overrides.cart,
    },
    cartItem: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
      ...overrides.cartItem,
    },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  } as unknown as PrismaService;
}

describe('CartsService', () => {
  describe('getCart', () => {
    it('returns an empty cart for a phone with no cart row', async () => {
      const prisma = makePrisma();
      const service = new CartsService(prisma);

      const result = await service.getCart('998901234567');

      expect(result).toEqual({ items: [] });
    });

    it('returns the stored lines when a cart exists', async () => {
      const findUnique = jest.fn().mockResolvedValue({
        items: [{ productId: 'p1', quantity: 2 }],
      });
      const prisma = makePrisma({ cart: { findUnique } });
      const service = new CartsService(prisma);

      const result = await service.getCart('998901234567');

      expect(result).toEqual({ items: [{ productId: 'p1', quantity: 2 }] });
    });
  });

  describe('setItem', () => {
    it('creates the cart if none exists and upserts the line', async () => {
      const upsertCart = jest.fn().mockResolvedValue({ id: 'cart-1' });
      const upsertItem = jest.fn().mockResolvedValue({});
      const findUnique = jest
        .fn()
        .mockResolvedValue({ items: [{ productId: 'p1', quantity: 3 }] });
      const prisma = makePrisma({
        cart: { upsert: upsertCart, findUnique },
        cartItem: { upsert: upsertItem },
      });
      const service = new CartsService(prisma);

      const result = await service.setItem('998901234567', 'p1', 3);

      expect(upsertCart).toHaveBeenCalledWith({
        where: { phone: '998901234567' },
        create: { phone: '998901234567' },
        update: {},
        select: { id: true },
      });
      expect(upsertItem).toHaveBeenCalledWith({
        where: { cartId_productId: { cartId: 'cart-1', productId: 'p1' } },
        create: { cartId: 'cart-1', productId: 'p1', quantity: 3 },
        update: { quantity: 3 },
      });
      expect(result).toEqual({ items: [{ productId: 'p1', quantity: 3 }] });
    });
  });

  describe('removeItem', () => {
    it('is a no-op when the phone has no cart at all', async () => {
      const deleteMany = jest.fn();
      const prisma = makePrisma({ cartItem: { deleteMany } });
      const service = new CartsService(prisma);

      const result = await service.removeItem('998901234567', 'p1');

      expect(deleteMany).not.toHaveBeenCalled();
      expect(result).toEqual({ items: [] });
    });

    it('deletes the line when a cart exists', async () => {
      const findUnique = jest
        .fn()
        .mockResolvedValueOnce({ id: 'cart-1' })
        .mockResolvedValueOnce({ items: [] });
      const deleteMany = jest.fn().mockResolvedValue({ count: 1 });
      const prisma = makePrisma({
        cart: { findUnique },
        cartItem: { deleteMany },
      });
      const service = new CartsService(prisma);

      await service.removeItem('998901234567', 'p1');

      expect(deleteMany).toHaveBeenCalledWith({
        where: { cartId: 'cart-1', productId: 'p1' },
      });
    });
  });

  describe('mergeGuest', () => {
    it('returns the current cart without writing when the guest list is empty', async () => {
      const upsertItem = jest.fn();
      const prisma = makePrisma({ cartItem: { upsert: upsertItem } });
      const service = new CartsService(prisma);

      const result = await service.mergeGuest('998901234567', []);

      expect(result).toEqual({ items: [] });
      expect(upsertItem).not.toHaveBeenCalled();
    });

    it('merges guest items into the server cart and writes the result', async () => {
      const findUnique = jest
        .fn()
        .mockResolvedValue({ items: [{ productId: 'p1', quantity: 2 }] });
      const upsertCart = jest.fn().mockResolvedValue({ id: 'cart-1' });
      const upsertItem = jest.fn().mockResolvedValue({});
      const prisma = makePrisma({
        cart: { findUnique, upsert: upsertCart },
        cartItem: { upsert: upsertItem },
      });
      const service = new CartsService(prisma);

      const result = await service.mergeGuest('998901234567', [
        { productId: 'p1', quantity: 3 },
        { productId: 'p2', quantity: 1 },
      ]);

      expect(result).toEqual({
        items: [
          { productId: 'p1', quantity: 5 },
          { productId: 'p2', quantity: 1 },
        ],
      });
      expect(upsertItem).toHaveBeenCalledTimes(2);
    });
  });
});
