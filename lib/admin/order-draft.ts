import { classifyDiscount } from "@/lib/api/discount-policy";
import { applyDiscount, roundMoney, subtotalOf } from "@/lib/api/order-money";

/**
 * The arithmetic behind the manual order form.
 *
 * Pure, and deliberately built on the same `order-money` and `discount-policy`
 * helpers the API uses. The seller sees a decision — "you can sign this" or
 * "this goes to the director" — before they save, and the server makes the same
 * decision again on the way in. Two implementations of that rule would let the
 * form promise something the API then refuses, which is exactly the surprise a
 * seller on a live call cannot absorb.
 */

/** A part on the form, before it becomes an `OrderItem`. */
export interface DraftLine {
  productId: string;
  sku: string;
  name: string;
  qty: number;
  /**
   * Snapshotted from the catalog on selection. Null only for a part priced on
   * request, where the seller types the figure and the API accepts it.
   */
  unitPrice: number | null;
  stock: number;
}

/** Percent columns are `Decimal(5, 2)`, so the form may not offer more. */
export function roundPercent(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Lines still missing a price contribute nothing rather than NaN. */
export function draftSubtotal(lines: readonly DraftLine[]): number {
  return subtotalOf(
    lines.map((line) => ({ qty: line.qty, unitPrice: line.unitPrice ?? 0 })),
  );
}

export function lineTotal(line: DraftLine): number {
  return roundMoney(line.qty * (line.unitPrice ?? 0));
}

/**
 * Turns the sum the seller agreed to into the percent the API speaks.
 *
 * The form asks for a figure rather than a percentage because that is the
 * number said out loud on the call. A total at or above the list price is not
 * a negative discount — this form has no way to raise a price, and reading one
 * as a discount of −3% would send nonsense to the ceiling check.
 */
export function discountPercentFor(subtotal: number, agreedTotal: number): number {
  if (subtotal <= 0 || agreedTotal >= subtotal) {
    return 0;
  }
  if (agreedTotal <= 0) {
    return 100;
  }

  return roundPercent((1 - agreedTotal / subtotal) * 100);
}

/**
 * What the order will actually total, which is not always what was typed.
 *
 * The percent is rounded to two decimals on its way into the column, so an
 * arbitrary agreed sum lands a few so'm off. The form quotes this figure back
 * rather than the typed one; a seller who reads their own number on screen and
 * a different one on the order would rightly stop trusting the screen.
 */
export function effectiveTotal(subtotal: number, percent: number): number {
  return applyDiscount(subtotal, percent);
}

export type DraftDiscount =
  /** List price. Nothing to approve, nothing to ask for. */
  | { kind: "none"; percent: 0; total: number }
  /** Inside the seller's own ceiling: applied the moment the order is saved. */
  | { kind: "immediate"; percent: number; total: number }
  /**
   * Above it. The order is saved at the undiscounted total and a request goes
   * to the director; `total` is what the order quotes until they answer.
   */
  | {
      kind: "needs_approval";
      percent: number;
      overBy: number;
      total: number;
      totalIfApproved: number;
    };

/**
 * The one decision this form exists to make, in the seller's terms.
 *
 * A director has no ceiling, which the caller expresses by passing 100 — the
 * same `DIRECTOR_DISCOUNT_LIMIT` the repository substitutes — so this function
 * never has to know about roles.
 */
export function decideDraftDiscount(
  subtotal: number,
  agreedTotal: number,
  limit: number,
): DraftDiscount {
  const percent = discountPercentFor(subtotal, agreedTotal);

  if (percent === 0) {
    return { kind: "none", percent: 0, total: subtotal };
  }

  if (classifyDiscount(percent, limit).kind === "immediate") {
    return { kind: "immediate", percent, total: effectiveTotal(subtotal, percent) };
  }

  return {
    kind: "needs_approval",
    percent,
    overBy: roundPercent(percent - limit),
    // Untouched until a director answers, so the seller quotes what they can
    // honour today rather than what they hope to honour tomorrow.
    total: subtotal,
    totalIfApproved: effectiveTotal(subtotal, percent),
  };
}

/** A line the shelf cannot cover. */
export interface StockShortfall {
  productId: string;
  name: string;
  requested: number;
  available: number;
}

/**
 * Every part the draft over-promises.
 *
 * Quantities are summed per product before the comparison, matching
 * `buildLines` on the server: two lines of the same pump are one claim on the
 * shelf, and checking them separately would let a draft pass here and fail on
 * save.
 */
export function stockShortfalls(lines: readonly DraftLine[]): StockShortfall[] {
  const requested = new Map<string, number>();

  for (const line of lines) {
    requested.set(line.productId, (requested.get(line.productId) ?? 0) + line.qty);
  }

  const shortfalls: StockShortfall[] = [];

  for (const line of lines) {
    const total = requested.get(line.productId);

    // Reported once per product, on its first line.
    if (total !== undefined && total > line.stock) {
      shortfalls.push({
        productId: line.productId,
        name: line.name,
        requested: total,
        available: line.stock,
      });
      requested.delete(line.productId);
    }
  }

  return shortfalls;
}

/**
 * The span the ceiling gauge draws.
 *
 * Fixed per seller rather than growing with what they type: a scale that
 * rescales as you type turns the mark you are watching into a mark that never
 * moves, which is the opposite of what the gauge is for. Four times the limit
 * puts the notch a quarter of the way along, leaving room to see how far past
 * it a request has gone, and the floor of 10% keeps the gauge readable for a
 * seller whose limit is very small or zero.
 */
export function ceilingScale(limit: number): number {
  return Math.min(100, Math.max(limit * 4, 10));
}

/** Gauge geometry, as percentages of the track's width. */
export interface CeilingMarks {
  fill: number;
  limitAt: number;
  /** True when the request runs off the end of the track. */
  overflows: boolean;
}

export function ceilingMarks(percent: number, limit: number): CeilingMarks {
  const scale = ceilingScale(limit);

  return {
    fill: Math.min(100, (percent / scale) * 100),
    limitAt: Math.min(100, (limit / scale) * 100),
    overflows: percent > scale,
  };
}
