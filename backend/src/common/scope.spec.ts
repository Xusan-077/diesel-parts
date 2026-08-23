import { Role } from '../../generated/prisma/client';
import {
  customerReadScope,
  customerWriteScope,
  inquiryReadScope,
  inquiryWriteScope,
  isDirector,
  orderReadScope,
  orderWriteScope,
  unclaimedScope,
  type ScopeActor,
} from './scope';

const seller: ScopeActor = { id: 'seller-1', role: Role.SELLER };
const director: ScopeActor = { id: 'director-1', role: Role.DIRECTOR };

describe('isDirector', () => {
  it('separates the two roles', () => {
    expect(isDirector(director)).toBe(true);
    expect(isDirector(seller)).toBe(false);
  });
});

describe('inquiry scopes', () => {
  it('shows a director every row', () => {
    expect(inquiryReadScope(director)).toEqual({});
  });

  it('shows a seller their own leads and the unclaimed pool', () => {
    expect(inquiryReadScope(seller)).toEqual({
      OR: [{ assignedSellerId: 'seller-1' }, { assignedSellerId: null }],
    });
  });

  it("narrows a seller's writes to leads they own", () => {
    expect(inquiryWriteScope(seller)).toEqual({ assignedSellerId: 'seller-1' });
  });

  it('does not let a seller write to the pool it lets them read', () => {
    // The rule the 404-not-403 answer rests on: reads are wider than writes,
    // and the claim is the only write allowed against an unowned row.
    expect(JSON.stringify(inquiryWriteScope(seller))).not.toContain('null');
  });

  it('leaves a director unscoped on writes too', () => {
    expect(inquiryWriteScope(director)).toEqual({});
  });
});

describe('customer scopes', () => {
  it('gives a seller only their own book by default', () => {
    expect(customerReadScope(seller)).toEqual({ assignedSellerId: 'seller-1' });
  });

  it('adds the unassigned pool when the pool tab asks for it', () => {
    expect(customerReadScope(seller, { includePool: true })).toEqual({
      OR: [{ assignedSellerId: 'seller-1' }, { assignedSellerId: null }],
    });
  });

  it('ignores the pool flag for a director, who already sees everything', () => {
    expect(customerReadScope(director, { includePool: true })).toEqual({});
    expect(customerReadScope(director)).toEqual({});
  });

  it("narrows a seller's writes to their own customers", () => {
    expect(customerWriteScope(seller)).toEqual({
      assignedSellerId: 'seller-1',
    });
    expect(customerWriteScope(director)).toEqual({});
  });
});

describe('order scopes', () => {
  it('never pools orders: a seller sees only their own', () => {
    expect(orderReadScope(seller)).toEqual({ sellerId: 'seller-1' });
    expect(orderWriteScope(seller)).toEqual({ sellerId: 'seller-1' });
  });

  it('shows a director every order', () => {
    expect(orderReadScope(director)).toEqual({});
    expect(orderWriteScope(director)).toEqual({});
  });

  it('reads and writes orders through the same filter', () => {
    expect(orderWriteScope(seller)).toEqual(orderReadScope(seller));
  });
});

describe('unclaimedScope', () => {
  it('is the compare-and-set guard a claim writes through', () => {
    expect(unclaimedScope()).toEqual({ assignedSellerId: null });
  });
});
