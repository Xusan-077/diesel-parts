import { ForbiddenException } from '@nestjs/common';
import { Role } from '../../generated/prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';

/**
 * A SELLER may only reach orders (and anything scoped to an order — items,
 * payments, invoices) that belong to them. Anyone MANAGER_UP sees all orders.
 *
 * `Order.sellerId` is a FK to `User`, so ownership compares against the actor's
 * user id — not `actor.sellerId`, which is the separate `Seller` profile id.
 */
export function assertOrderVisible(
  actor: AuthenticatedUser,
  orderSellerId: string,
) {
  if (actor.role === Role.SELLER && actor.id !== orderSellerId) {
    throw new ForbiddenException('You cannot access another seller’s order');
  }
}
