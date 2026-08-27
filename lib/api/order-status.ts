import type { OrderStatus } from "@/prisma/generated/prisma/enums";

/**
 * The order lifecycle, in the seller's hands from end to end.
 *
 * Every transition writes an `AuditLog` row; that trail is the control that
 * makes seller-driven completion acceptable, in the same way the discount
 * ceiling is the control on seller-driven pricing.
 */
const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  DRAFT: ["PENDING", "CANCELLED"],
  // PENDING is shared by both paths: a staff order moves straight to
  // CONFIRMED; a checkout order steps into PAYMENT_PENDING instead.
  PENDING: ["CONFIRMED", "PAYMENT_PENDING", "CANCELLED"],
  PAYMENT_PENDING: ["PAID", "PAYMENT_FAILED"],
  PAYMENT_FAILED: ["PAYMENT_PENDING", "CANCELLED"],
  PAID: ["CONFIRMED", "REFUNDED"],
  CONFIRMED: ["PROCESSING", "COMPLETED", "CANCELLED"],
  PROCESSING: ["READY_FOR_SHIPMENT", "CANCELLED"],
  READY_FOR_SHIPMENT: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: ["REFUNDED"],
  COMPLETED: [],
  CANCELLED: [],
  REFUNDED: [],
};

/** Statuses from which an order may still be edited rather than only moved. */
const EDITABLE: readonly OrderStatus[] = ["DRAFT", "PENDING"];

export function allowedTransitions(current: OrderStatus): readonly OrderStatus[] {
  return TRANSITIONS[current];
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isTerminal(status: OrderStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

/**
 * From CONFIRMED onward the order is the record of an agreement, so its lines
 * and its discount are frozen and only the status may still move.
 */
export function isEditable(status: OrderStatus): boolean {
  return EDITABLE.includes(status);
}
