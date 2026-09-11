import { canTransition } from './order-status-transitions';
import { OrderStatus } from '../../generated/prisma/client';

describe('canTransition', () => {
  it('allows the happy path DRAFT -> PENDING -> CONFIRMED -> COMPLETED', () => {
    expect(canTransition(OrderStatus.DRAFT, OrderStatus.PENDING)).toBe(true);
    expect(canTransition(OrderStatus.PENDING, OrderStatus.CONFIRMED)).toBe(
      true,
    );
    expect(canTransition(OrderStatus.CONFIRMED, OrderStatus.COMPLETED)).toBe(
      true,
    );
  });

  it('allows the CONFIRMED -> PREPARING -> COMPLETED detour', () => {
    expect(canTransition(OrderStatus.CONFIRMED, OrderStatus.PREPARING)).toBe(
      true,
    );
    expect(canTransition(OrderStatus.PREPARING, OrderStatus.COMPLETED)).toBe(
      true,
    );
  });

  it('allows cancelling from DRAFT, PENDING, CONFIRMED, or PREPARING', () => {
    expect(canTransition(OrderStatus.DRAFT, OrderStatus.CANCELLED)).toBe(true);
    expect(canTransition(OrderStatus.PENDING, OrderStatus.CANCELLED)).toBe(
      true,
    );
    expect(canTransition(OrderStatus.CONFIRMED, OrderStatus.CANCELLED)).toBe(
      true,
    );
    expect(canTransition(OrderStatus.PREPARING, OrderStatus.CANCELLED)).toBe(
      true,
    );
  });

  it('rejects skipping a stage', () => {
    expect(canTransition(OrderStatus.DRAFT, OrderStatus.CONFIRMED)).toBe(false);
    expect(canTransition(OrderStatus.PENDING, OrderStatus.COMPLETED)).toBe(
      false,
    );
  });

  it('rejects any transition out of a terminal state', () => {
    expect(canTransition(OrderStatus.COMPLETED, OrderStatus.CANCELLED)).toBe(
      false,
    );
    expect(canTransition(OrderStatus.CANCELLED, OrderStatus.PENDING)).toBe(
      false,
    );
  });

  it('allows a return to move a COMPLETED order to (partially) refunded', () => {
    expect(
      canTransition(OrderStatus.COMPLETED, OrderStatus.PARTIALLY_REFUNDED),
    ).toBe(true);
    expect(canTransition(OrderStatus.COMPLETED, OrderStatus.REFUNDED)).toBe(
      true,
    );
    expect(
      canTransition(OrderStatus.PARTIALLY_REFUNDED, OrderStatus.REFUNDED),
    ).toBe(true);
  });

  it('rejects any transition out of REFUNDED, or back to an active state from PARTIALLY_REFUNDED', () => {
    expect(canTransition(OrderStatus.REFUNDED, OrderStatus.COMPLETED)).toBe(
      false,
    );
    expect(
      canTransition(OrderStatus.PARTIALLY_REFUNDED, OrderStatus.COMPLETED),
    ).toBe(false);
    expect(
      canTransition(OrderStatus.PARTIALLY_REFUNDED, OrderStatus.CANCELLED),
    ).toBe(false);
  });
});
