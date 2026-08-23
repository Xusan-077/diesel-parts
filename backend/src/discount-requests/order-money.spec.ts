import { applyDiscount, roundMoney } from './order-money';

describe('roundMoney', () => {
  it('rounds to two decimals', () => {
    expect(roundMoney(1.005)).toBe(1.01);
  });

  it('leaves an already-clean value unchanged', () => {
    expect(roundMoney(100)).toBe(100);
  });
});

describe('applyDiscount', () => {
  it('returns the subtotal unchanged at 0%', () => {
    expect(applyDiscount(1000, 0)).toBe(1000);
  });

  it('applies a partial percent and rounds the result', () => {
    expect(applyDiscount(1000, 12.5)).toBe(875);
  });

  it('returns 0 at 100%', () => {
    expect(applyDiscount(1000, 100)).toBe(0);
  });

  it('rounds a fractional result to two decimals', () => {
    expect(applyDiscount(99.99, 10)).toBe(89.99);
  });
});
