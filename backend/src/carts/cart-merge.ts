export interface CartItemRow {
  productId: string;
  quantity: number;
}

export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 99;

function clampQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return MIN_QUANTITY;
  return Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, Math.trunc(quantity)));
}

function addItem(
  items: readonly CartItemRow[],
  productId: string,
  quantity: number,
): CartItemRow[] {
  const existing = items.find((item) => item.productId === productId);
  if (!existing) {
    return [...items, { productId, quantity: clampQuantity(quantity) }];
  }
  return items.map((item) =>
    item.productId === productId
      ? { ...item, quantity: clampQuantity(item.quantity + quantity) }
      : item,
  );
}

/**
 * Folds a guest's localStorage cart into the server cart on login.
 *
 * Ported from the (removed) root app's lib/store/cart.ts — same logic, same
 * tests, moved here because the cart itself now lives in backend/. The two
 * apps don't share a package today (see common/phone.ts's own doc-comment
 * for the precedent), so this is a deliberate port, not an import.
 */
export function mergeCartItems(
  serverItems: readonly CartItemRow[],
  guestItems: readonly CartItemRow[],
): CartItemRow[] {
  return guestItems.reduce(
    (merged, item) => addItem(merged, item.productId, item.quantity),
    [...serverItems] as CartItemRow[],
  );
}
