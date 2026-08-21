import type { InquiryColumn } from "@/lib/api/inquiry-board";
import type { OrderStatus } from "@/prisma/generated/prisma/enums";

/**
 * One customer's history, as a single column.
 *
 * A mini-CRM answers one question — "what is the story with this account?" —
 * and the answer is split across two tables: the inquiries the number has sent
 * and the orders raised against the card. Two lists side by side would make the
 * seller interleave them by eye, so they are merged here into one sequence and
 * the entry says which kind it is.
 *
 * Pure, and fed rows that are already formatted, so the ordering rules can be
 * tested without a database or a clock.
 */

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  DRAFT: "Qoralama",
  PENDING: "Kutilmoqda",
  CONFIRMED: "Tasdiqlangan",
  COMPLETED: "Yopilgan",
  CANCELLED: "Bekor qilingan",
};

export interface TimelineInquiry {
  kind: "inquiry";
  id: string;
  /** Epoch milliseconds. Sorting key only — nothing renders it. */
  at: number;
  dateLabel: string;
  /** The board's own column, so both screens name a lead the same way. */
  column: InquiryColumn;
  message: string;
  productSku: string | null;
  quantity: number | null;
  notes: string | null;
  /** Null while the lead is still in the pool. */
  sellerName: string | null;
}

export interface TimelineOrder {
  kind: "order";
  id: string;
  at: number;
  dateLabel: string;
  status: OrderStatus;
  orderNumber: string;
  itemCount: number;
  totalAmount: number;
  discountPercent: number;
  notes: string | null;
  sellerName: string;
}

export type TimelineEntry = TimelineInquiry | TimelineOrder;

/**
 * Newest first, with ties broken by id.
 *
 * The tie-break is not cosmetic: an order raised from a board card in the same
 * second as the lead it came from would otherwise sort differently between two
 * renders of the same page, and a history that reshuffles on refresh reads as a
 * bug. Id is the only value here that is guaranteed distinct.
 */
export function mergeTimeline(
  inquiries: readonly TimelineInquiry[],
  orders: readonly TimelineOrder[],
): TimelineEntry[] {
  return [...inquiries, ...orders].sort((left, right) => {
    if (left.at !== right.at) {
      return right.at - left.at;
    }
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });
}

/**
 * What the customer is worth, counted from closed business only.
 *
 * A draft is a seller's intention and a cancelled order is one that did not
 * happen; adding either to a lifetime total would let the figure be inflated by
 * typing. Orders still in flight are counted separately so the seller can see
 * there is something open without it being banked.
 */
export interface CustomerValue {
  /** Sum of COMPLETED orders. */
  earned: number;
  /** Sum of orders that are neither completed nor cancelled. */
  open: number;
  completedCount: number;
  openCount: number;
}

export function summariseValue(orders: readonly TimelineOrder[]): CustomerValue {
  const value: CustomerValue = { earned: 0, open: 0, completedCount: 0, openCount: 0 };

  for (const order of orders) {
    if (order.status === "COMPLETED") {
      value.earned += order.totalAmount;
      value.completedCount += 1;
    } else if (order.status !== "CANCELLED") {
      value.open += order.totalAmount;
      value.openCount += 1;
    }
  }

  return value;
}
