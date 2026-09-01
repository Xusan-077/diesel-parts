import { OrderStatus } from '../../generated/prisma/client';

/**
 * DRAFT -> PENDING -> CONFIRMED -> COMPLETED, with CANCELLED reachable up
 * until COMPLETED. DRAFT (the CRM board's not-yet-submitted state) can only
 * move on to PENDING or be abandoned via CANCELLED.
 *
 * NOTE: production's `OrderStatus` enum currently has no `PREPARING`; the
 * CONFIRMED -> PREPARING -> COMPLETED intermediate step is restored in
 * schema-alignment step 2 (`ALTER TYPE ... ADD VALUE`). Until then CONFIRMED
 * transitions straight to COMPLETED. `PENDING` is what used to be `NEW`.
 */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: [OrderStatus.PENDING, OrderStatus.CANCELLED],
  PENDING: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  CONFIRMED: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}
