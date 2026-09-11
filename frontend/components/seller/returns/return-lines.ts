import type { Order, Return } from "@/lib/api/seller-panel/types";

export interface ReturnableLine {
  productId: string;
  sku: string;
  name: string;
  unitPrice: number;
  /** Total qty of this product across every line on the order. */
  purchasedQty: number;
  /** What earlier returns on this same order already took. */
  alreadyReturnedQty: number;
  /** `purchasedQty - alreadyReturnedQty` — the most this new return can take. */
  remainingQty: number;
}

/**
 * One row per distinct product on the order, purchased quantities across
 * duplicate lines summed and already-returned quantity subtracted — mirrors
 * ReturnsService.create's own `originalByProduct`/`alreadyReturnedByProduct`
 * bookkeeping exactly, so a line this form lets through never exceeds what
 * the backend itself would accept.
 */
export function computeReturnableLines(
  order: Order,
  existingReturns: Return[],
): ReturnableLine[] {
  const purchased = new Map<
    string,
    { qty: number; unitPrice: number; sku: string; name: string }
  >();
  for (const item of order.items) {
    const existing = purchased.get(item.productId);
    purchased.set(item.productId, {
      qty: (existing?.qty ?? 0) + item.qty,
      unitPrice: existing?.unitPrice ?? Number(item.unitPrice),
      sku: item.productSku,
      name: item.productName,
    });
  }

  const alreadyReturned = new Map<string, number>();
  for (const ret of existingReturns) {
    for (const line of ret.items) {
      alreadyReturned.set(
        line.productId,
        (alreadyReturned.get(line.productId) ?? 0) + line.qty,
      );
    }
  }

  return [...purchased.entries()].map(([productId, agg]) => {
    const returned = alreadyReturned.get(productId) ?? 0;
    return {
      productId,
      sku: agg.sku,
      name: agg.name,
      unitPrice: agg.unitPrice,
      purchasedQty: agg.qty,
      alreadyReturnedQty: returned,
      remainingQty: Math.max(0, agg.qty - returned),
    };
  });
}
