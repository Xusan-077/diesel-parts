import { classifyDiscount, DIRECTOR_DISCOUNT_LIMIT } from './discount-policy';

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
