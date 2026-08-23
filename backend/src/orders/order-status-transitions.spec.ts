import { canTransition } from './order-status-transitions';
import { OrderStatus } from '../../generated/prisma/client';

describe('canTransition', () => {
  it('allows the happy path NEW -> CONFIRMED -> PREPARING -> COMPLETED', () => {
    expect(canTransition(OrderStatus.NEW, OrderStatus.CONFIRMED)).toBe(true);
    expect(canTransition(OrderStatus.CONFIRMED, OrderStatus.PREPARING)).toBe(
      true,
    );
    expect(canTransition(OrderStatus.PREPARING, OrderStatus.COMPLETED)).toBe(
      true,
    );
  });

  it('allows cancelling from NEW, CONFIRMED, or PREPARING', () => {
    expect(canTransition(OrderStatus.NEW, OrderStatus.CANCELLED)).toBe(true);
    expect(canTransition(OrderStatus.CONFIRMED, OrderStatus.CANCELLED)).toBe(
      true,
    );
    expect(canTransition(OrderStatus.PREPARING, OrderStatus.CANCELLED)).toBe(
      true,
    );
  });

  it('rejects skipping a stage', () => {
    expect(canTransition(OrderStatus.NEW, OrderStatus.PREPARING)).toBe(false);
    expect(canTransition(OrderStatus.NEW, OrderStatus.COMPLETED)).toBe(false);
    expect(canTransition(OrderStatus.CONFIRMED, OrderStatus.COMPLETED)).toBe(
      false,
    );
  });

  it('rejects any transition out of a terminal state', () => {
    expect(canTransition(OrderStatus.COMPLETED, OrderStatus.CANCELLED)).toBe(
      false,
    );
    expect(canTransition(OrderStatus.CANCELLED, OrderStatus.NEW)).toBe(false);
  });
});
