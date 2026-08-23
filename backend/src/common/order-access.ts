import { ForbiddenException } from '@nestjs/common';
import { Role } from '../../generated/prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';

/** A SELLER may only reach orders (and anything scoped to an order — items, payments, invoices) that belong to them. Anyone MANAGER_UP sees all orders. */
export function assertOrderVisible(
  actor: AuthenticatedUser,
  orderSellerId: string,
) {
  if (actor.role === Role.SELLER && actor.sellerId !== orderSellerId) {
    throw new ForbiddenException('You cannot access another seller’s order');
  }
}
