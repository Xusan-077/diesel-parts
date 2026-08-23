import { OrderStatus } from '../../generated/prisma/client';

/**
 * NEW -> CONFIRMED -> PREPARING -> COMPLETED, with CANCELLED reachable up
 * until COMPLETED. DRAFT (the CRM board's not-yet-submitted state) can only
 * move on to NEW or be abandoned via CANCELLED; this is a placeholder -
 * Task 10 defines the full unified transition table for the CRM flow.
 */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: [OrderStatus.NEW, OrderStatus.CANCELLED],
  NEW: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  CONFIRMED: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  PREPARING: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}
