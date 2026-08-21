/**
 * The one implementation of order arithmetic.
 *
 * `applyDiscount` began as a private copy inside `discount-repository.ts`;
 * that file now imports it from here. Two copies of the rule that turns a
 * percent into a total is exactly the drift that would let the director's
 * approval screen quote one figure and the seller's order another.
 */

/**
 * Rounds to the two decimals the `Decimal(14, 2)` columns hold.
 *
 * Feeding an unrounded float to the column leaves the database to round, and
 * the total the seller was shown before saving can then differ from the one
 * stored. The epsilon nudges values such as 1.005, which is really 1.00499…
 * in binary floating point, onto the side a person reading the figure expects.
 */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export interface MoneyLine {
  qty: number;
  unitPrice: number;
}

export function subtotalOf(items: readonly MoneyLine[]): number {
  return roundMoney(items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0));
}

export function applyDiscount(subtotal: number, percent: number): number {
  return roundMoney(subtotal * (1 - percent / 100));
}
