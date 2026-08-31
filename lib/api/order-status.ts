import type { OrderStatus } from "@/lib/api/backend-enums";

/**
 * The order lifecycle, in the seller's hands from end to end.
 *
 * Every transition writes an `AuditLog` row; that trail is the control that
 * makes seller-driven completion acceptable, in the same way the discount
 * ceiling is the control on seller-driven pricing.
 */
const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  DRAFT: ["PENDING", "CANCELLED"],
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
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
