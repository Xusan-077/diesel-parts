/**
 * The cart, wishlist and compare lists hold nothing but product ids, and they
 * outlive the catalog: a part the director retires is still sitting in every
 * visitor's localStorage. `/api/products/by-ids` drops those ids silently, so
 * the page lists two lines while the header badge — which counts what is
 * stored — insists there are three, and nothing on screen can clear the third.
 *
 * These are the pure halves of the reconciliation.
 */

/** Ids the catalog did not answer for, i.e. products that are gone. */
export function missingIds(
  requested: readonly string[],
  resolved: readonly string[]
): string[] {
  const found = new Set(resolved);
  return requested.filter((id) => !found.has(id));
}

/**
 * Whether a resolution may be used to delete anything.
 *
 * Two ways an absent id means "not right now" rather than "gone for good": a
 * read that has not succeeded (offline, 500, still in flight), and a list
 * longer than the endpoint's own cap, where the tail was never asked about.
 * Either way the ids stay put — losing a cart to a blip is far worse than
 * carrying a stale line for another visit.
 */
export function canPrune(
  requestedCount: number,
  cap: number,
  succeeded: boolean
): boolean {
  return succeeded && requestedCount > 0 && requestedCount <= cap;
}
