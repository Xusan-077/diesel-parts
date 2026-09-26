/**
 * Whether a discount is the seller's to give.
 *
 * Pure, because this is the rule `User.discountLimit` exists to express and it
 * has to read the same way from the order form, the API and a test.
 *
 * Ported verbatim from the root Next.js app's `lib/api/discount-policy.ts`.
 */
export type DiscountClassification =
  { kind: 'immediate' } | { kind: 'needs_approval' };

/** A director is bound by no ceiling: they are the approval path. */
export const DIRECTOR_DISCOUNT_LIMIT = 100;

/**
 * The hard ceiling on what a SELLER may ever request, director-approval or
 * not — distinct from `User.discountLimit`, which only decides whether a
 * request auto-applies (see `classifyDiscount`). Config-overridable; read
 * live rather than cached at module-load so an ops env-var change (or a
 * test) doesn't need a process restart to take effect.
 */
export function sellerMaxDiscountPercent(): number {
  const raw = process.env.SELLER_MAX_DISCOUNT_PERCENT;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : 20;
}

export function classifyDiscount(
  requestedPercent: number,
  sellerLimit: number,
): DiscountClassification {
  // At the limit exactly is inside it: a 5% ceiling that refuses 5% would read
  // as a 4.99% ceiling to everyone using it.
  return requestedPercent <= sellerLimit
    ? { kind: 'immediate' }
    : { kind: 'needs_approval' };
}
