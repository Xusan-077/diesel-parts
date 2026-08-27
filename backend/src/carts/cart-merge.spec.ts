import { mergeCartItems, MAX_QUANTITY } from './cart-merge';

describe('mergeCartItems', () => {
  it('unions two carts with no overlap', () => {
    const merged = mergeCartItems(
      [{ productId: 'p1', quantity: 2 }],
      [{ productId: 'p2', quantity: 3 }],
    );
    expect(merged).toEqual([
      { productId: 'p1', quantity: 2 },
      { productId: 'p2', quantity: 3 },
    ]);
  });

  it('sums quantities for a product in both carts instead of duplicating the line', () => {
    const merged = mergeCartItems(
      [{ productId: 'p1', quantity: 2 }],
      [{ productId: 'p1', quantity: 3 }],
    );
    expect(merged).toEqual([{ productId: 'p1', quantity: 5 }]);
  });

  it('caps the summed quantity at the maximum', () => {
    const merged = mergeCartItems(
      [{ productId: 'p1', quantity: 90 }],
      [{ productId: 'p1', quantity: 90 }],
    );
    expect(merged).toEqual([{ productId: 'p1', quantity: MAX_QUANTITY }]);
  });

  it('returns the server cart unchanged when the guest cart is empty', () => {
    const server = [{ productId: 'p1', quantity: 2 }];
    expect(mergeCartItems(server, [])).toEqual(server);
  });

  it('never mutates either input', () => {
    const server = [{ productId: 'p1', quantity: 2 }];
    const guest = [{ productId: 'p1', quantity: 3 }];
    mergeCartItems(server, guest);
    expect(server).toEqual([{ productId: 'p1', quantity: 2 }]);
    expect(guest).toEqual([{ productId: 'p1', quantity: 3 }]);
  });
});
