export interface CartItem {
  productId: string;
  quantity: number;
}

export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 99;

function clampQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) {
    return MIN_QUANTITY;
  }
  return Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, Math.trunc(quantity)));
}

export function findCartItem(items: readonly CartItem[], productId: string): CartItem | undefined {
  return items.find((item) => item.productId === productId);
}

/** Adds the product, or tops up its quantity when it is already in the cart. */
export function addToCart(
  items: readonly CartItem[],
  productId: string,
  quantity: number = 1
): CartItem[] {
  const existing = findCartItem(items, productId);
  if (!existing) {
    return [...items, { productId, quantity: clampQuantity(quantity) }];
  }
  return items.map((item) =>
    item.productId === productId
      ? { ...item, quantity: clampQuantity(item.quantity + quantity) }
      : item
  );
}

/** Sets an absolute quantity. Anything below the minimum removes the line. */
export function setCartQuantity(
  items: readonly CartItem[],
  productId: string,
  quantity: number
): CartItem[] {
  if (Number.isFinite(quantity) && Math.trunc(quantity) < MIN_QUANTITY) {
    return removeFromCart(items, productId);
  }
  return items.map((item) =>
    item.productId === productId ? { ...item, quantity: clampQuantity(quantity) } : item
  );
}

export function removeFromCart(items: readonly CartItem[], productId: string): CartItem[] {
  return items.filter((item) => item.productId !== productId);
}

/**
 * Total units across the cart — the number on the header badge, in the cart
 * page's summary, and prefilled into a quote request.
 *
 * All three used to add the quantities up themselves, which is how "two kinds
 * of part" and "four parts" ended up being shown as the same number in
 * different places. Anything with a `quantity` is accepted, because the callers
 * hold three different shapes of line — the stored `{ productId, quantity }`,
 * a resolved line carrying the whole product — and none of the rest of a line
 * is any of this function's business.
 */
export function cartUnitCount(lines: readonly { quantity: number }[]): number {
  return lines.reduce((total, line) => total + line.quantity, 0);
}

/** Number of distinct products, i.e. cart lines. Its counterpart above. */
export function cartLineCount(lines: readonly unknown[]): number {
  return lines.length;
}

/** Accepts anything read back from localStorage and returns a clean cart. */
export function parseCart(raw: unknown): CartItem[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const byProduct = new Map<string, number>();
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }
    const { productId, quantity } = entry as { productId?: unknown; quantity?: unknown };
    if (typeof productId !== "string" || productId.length === 0) {
      continue;
    }
    if (typeof quantity !== "number") {
      continue;
    }
    byProduct.set(productId, clampQuantity(quantity));
  }

  return [...byProduct].map(([productId, quantity]) => ({ productId, quantity }));
}

/**
 * Folds a guest's localStorage cart into the server cart on login.
 *
 * Built on addToCart rather than its own summing logic, so "how two lines of
 * the same part combine" has exactly one implementation — the one
 * addToCart's own tests already cover — instead of a second copy that could
 * drift from it.
 */
export function mergeCartItems(
  serverItems: readonly CartItem[],
  guestItems: readonly CartItem[]
): CartItem[] {
  return guestItems.reduce(
    (merged, item) => addToCart(merged, item.productId, item.quantity),
    [...serverItems]
  );
}
