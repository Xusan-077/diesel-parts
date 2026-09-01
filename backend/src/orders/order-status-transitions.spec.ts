import { canTransition } from './order-status-transitions';
import { OrderStatus } from '../../generated/prisma/client';

describe('canTransition', () => {
  it('allows the happy path DRAFT -> PENDING -> CONFIRMED -> COMPLETED', () => {
    expect(canTransition(OrderStatus.DRAFT, OrderStatus.PENDING)).toBe(true);
    expect(canTransition(OrderStatus.PENDING, OrderStatus.CONFIRMED)).toBe(true);
    expect(canTransition(OrderStatus.CONFIRMED, OrderStatus.COMPLETED)).toBe(
      true,
    );
  });

  it('allows cancelling from DRAFT, PENDING, or CONFIRMED', () => {
    expect(canTransition(OrderStatus.DRAFT, OrderStatus.CANCELLED)).toBe(true);
    expect(canTransition(OrderStatus.PENDING, OrderStatus.CANCELLED)).toBe(true);
    expect(canTransition(OrderStatus.CONFIRMED, OrderStatus.CANCELLED)).toBe(
      true,
    );
  });

  it('rejects skipping a stage', () => {
    expect(canTransition(OrderStatus.DRAFT, OrderStatus.CONFIRMED)).toBe(false);
    expect(canTransition(OrderStatus.PENDING, OrderStatus.COMPLETED)).toBe(false);
  });

  it('rejects any transition out of a terminal state', () => {
    expect(canTransition(OrderStatus.COMPLETED, OrderStatus.CANCELLED)).toBe(
      false,
    );
    expect(canTransition(OrderStatus.CANCELLED, OrderStatus.PENDING)).toBe(false);
  });
});
