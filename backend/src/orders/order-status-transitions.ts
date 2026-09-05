import { OrderStatus } from '../../generated/prisma/client';

/**
 * DRAFT -> PENDING -> CONFIRMED -> COMPLETED, with an optional
 * CONFIRMED -> PREPARING -> COMPLETED detour (PREPARING returned to prod's
 * enum in schema-alignment step 2) and CANCELLED reachable up until COMPLETED.
 * DRAFT (the CRM board's not-yet-submitted state) can only move on to PENDING
 * or be abandoned via CANCELLED.
 *
 * `NEW` is the legacy name for `PENDING` (D3) — the app only ever writes
 * `PENDING`, but the value still exists in the enum, so it is mapped to the
 * same out-edges in case an old row carries it.
 */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: [OrderStatus.PENDING, OrderStatus.CANCELLED],
  NEW: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  PENDING: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  CONFIRMED: [
    OrderStatus.PREPARING,
    OrderStatus.COMPLETED,
    OrderStatus.CANCELLED,
  ],
  PREPARING: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}
