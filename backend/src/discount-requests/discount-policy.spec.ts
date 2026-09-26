import {
  classifyDiscount,
  DIRECTOR_DISCOUNT_LIMIT,
  sellerMaxDiscountPercent,
} from './discount-policy';

describe('classifyDiscount', () => {
  it('is immediate when the requested percent is below the seller limit', () => {
    expect(classifyDiscount(3, 5)).toEqual({ kind: 'immediate' });
  });

  it('is immediate exactly at the seller limit', () => {
    expect(classifyDiscount(5, 5)).toEqual({ kind: 'immediate' });
  });

  it('needs approval just above the seller limit', () => {
    expect(classifyDiscount(5.01, 5)).toEqual({ kind: 'needs_approval' });
  });

  it('needs approval well above the seller limit', () => {
    expect(classifyDiscount(50, 5)).toEqual({ kind: 'needs_approval' });
  });

  it('is immediate for a director, whose limit is DIRECTOR_DISCOUNT_LIMIT', () => {
    expect(classifyDiscount(80, DIRECTOR_DISCOUNT_LIMIT)).toEqual({
      kind: 'immediate',
    });
  });

  it('treats a zero seller limit as no self-serve discount', () => {
    expect(classifyDiscount(0, 0)).toEqual({ kind: 'immediate' });
    expect(classifyDiscount(1, 0)).toEqual({ kind: 'needs_approval' });
  });
});

describe('sellerMaxDiscountPercent', () => {
  const original = process.env.SELLER_MAX_DISCOUNT_PERCENT;

  afterEach(() => {
    if (original === undefined) delete process.env.SELLER_MAX_DISCOUNT_PERCENT;
    else process.env.SELLER_MAX_DISCOUNT_PERCENT = original;
  });

  it('defaults to 20', () => {
    delete process.env.SELLER_MAX_DISCOUNT_PERCENT;
    expect(sellerMaxDiscountPercent()).toBe(20);
  });

  it('is overridable via env', () => {
    process.env.SELLER_MAX_DISCOUNT_PERCENT = '15';
    expect(sellerMaxDiscountPercent()).toBe(15);
  });

  it('ignores a non-numeric override and falls back to the default', () => {
    process.env.SELLER_MAX_DISCOUNT_PERCENT = 'not-a-number';
    expect(sellerMaxDiscountPercent()).toBe(20);
  });
});
