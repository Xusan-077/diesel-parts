/**
 * `applyDiscount`, ported from the root Next.js app's `lib/api/order-money.ts`.
 *
 * That file is the one implementation of order arithmetic and also holds
 * `subtotalOf`/order-line math the Orders module (Task 10 of the backend
 * consolidation plan) owns porting as `backend/src/orders/order-money.ts`.
 * Task 4 (this module) only needs `applyDiscount` — for
 * `DiscountRequestsService.listPending`'s `totalIfApproved` preview and for
 * writing the order's new total on approval — so it lives here rather than
 * blocking on a file this module does not own. Task 10 should import this
 * function (or fold it into its own `order-money.ts`) instead of
 * reimplementing it, so the rule that turns a percent into a total is still
 * stated once.
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

export function applyDiscount(subtotal: number, percent: number): number {
  return roundMoney(subtotal * (1 - percent / 100));
}
