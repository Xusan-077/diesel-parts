import { describe, expect, it } from "vitest";
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
} from "./seller-scope";

const seller: ScopeActor = { id: "seller-1", role: "SELLER" };
const director: ScopeActor = { id: "director-1", role: "DIRECTOR" };

describe("isDirector", () => {
  it("separates the two roles", () => {
    expect(isDirector(director)).toBe(true);
    expect(isDirector(seller)).toBe(false);
  });
});

describe("inquiry scopes", () => {
  it("shows a director every row", () => {
    expect(inquiryReadScope(director)).toEqual({});
  });

  it("shows a seller their own leads and the unclaimed pool", () => {
    expect(inquiryReadScope(seller)).toEqual({
      OR: [{ assignedSellerId: "seller-1" }, { assignedSellerId: null }],
    });
  });

  it("narrows a seller's writes to leads they own", () => {
    expect(inquiryWriteScope(seller)).toEqual({ assignedSellerId: "seller-1" });
  });

  it("does not let a seller write to the pool it lets them read", () => {
    // The rule the 404-not-403 answer rests on: reads are wider than writes,
    // and the claim is the only write allowed against an unowned row.
    expect(JSON.stringify(inquiryWriteScope(seller))).not.toContain("null");
  });

  it("leaves a director unscoped on writes too", () => {
    expect(inquiryWriteScope(director)).toEqual({});
  });
});

describe("customer scopes", () => {
  it("gives a seller only their own book by default", () => {
    expect(customerReadScope(seller)).toEqual({ assignedSellerId: "seller-1" });
  });

  it("adds the unassigned pool when the pool tab asks for it", () => {
    expect(customerReadScope(seller, { includePool: true })).toEqual({
      OR: [{ assignedSellerId: "seller-1" }, { assignedSellerId: null }],
    });
  });

  it("ignores the pool flag for a director, who already sees everything", () => {
    expect(customerReadScope(director, { includePool: true })).toEqual({});
    expect(customerReadScope(director)).toEqual({});
  });

  it("narrows a seller's writes to their own customers", () => {
    expect(customerWriteScope(seller)).toEqual({ assignedSellerId: "seller-1" });
    expect(customerWriteScope(director)).toEqual({});
  });
});

describe("order scopes", () => {
  it("shows a seller their own orders plus every ONLINE-channel order", () => {
    // A self-checkout order has no seller relationship to hand it to, so it
    // reads like the Customer/Inquiry pool: visible to any seller, not
    // locked to whoever happens to own the sellerId column.
    expect(orderReadScope(seller)).toEqual({
      OR: [{ sellerId: "seller-1" }, { channel: "ONLINE" }],
    });
  });

  it("narrows a seller's writes to orders they already own, same as Customer/Inquiry", () => {
    // There is no claim step for orders yet, so a pooled ONLINE order is not
    // writable by just any seller — only whichever sellerId it actually
    // names, exactly like a staff order always was.
    expect(orderWriteScope(seller)).toEqual({ sellerId: "seller-1" });
  });

  it("does not let a seller write to the pool it lets them read", () => {
    expect(JSON.stringify(orderWriteScope(seller))).not.toContain("ONLINE");
  });

  it("shows a director every order", () => {
    expect(orderReadScope(director)).toEqual({});
    expect(orderWriteScope(director)).toEqual({});
  });
});

describe("unclaimedScope", () => {
  it("is the compare-and-set guard a claim writes through", () => {
    expect(unclaimedScope()).toEqual({ assignedSellerId: null });
  });
});
