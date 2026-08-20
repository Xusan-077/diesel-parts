import { describe, expect, it } from "vitest";
import {
  mergeTimeline,
  summariseValue,
  type TimelineInquiry,
  type TimelineOrder,
} from "./customer-timeline";

function inquiry(overrides: Partial<TimelineInquiry> = {}): TimelineInquiry {
  return {
    kind: "inquiry",
    id: "inq-1",
    at: 1_000,
    dateLabel: "19 avg, 09:30",
    column: "new",
    message: "Forsunka bormi?",
    productSku: null,
    quantity: null,
    notes: null,
    sellerName: null,
    ...overrides,
  };
}

function order(overrides: Partial<TimelineOrder> = {}): TimelineOrder {
  return {
    kind: "order",
    id: "ord-1",
    at: 2_000,
    dateLabel: "19 avg, 11:00",
    status: "COMPLETED",
    orderNumber: "DP-2026-0042",
    itemCount: 2,
    totalAmount: 1_000_000,
    discountPercent: 0,
    notes: null,
    sellerName: "Nodir Karimov",
    ...overrides,
  };
}

describe("mergeTimeline", () => {
  it("puts the newest entry first whichever kind it is", () => {
    const merged = mergeTimeline(
      [inquiry({ id: "a", at: 3_000 }), inquiry({ id: "b", at: 1_000 })],
      [order({ id: "c", at: 2_000 })],
    );

    expect(merged.map((entry) => entry.id)).toEqual(["a", "c", "b"]);
  });

  it("orders same-instant entries by id, so a refresh cannot reshuffle them", () => {
    // An order raised from a board card can share the lead's timestamp to the
    // millisecond; without the tie-break the two would swap between renders.
    const first = mergeTimeline([inquiry({ id: "a", at: 500 })], [order({ id: "b", at: 500 })]);
    const second = mergeTimeline([inquiry({ id: "a", at: 500 })], [order({ id: "b", at: 500 })]);

    expect(first.map((entry) => entry.id)).toEqual(["a", "b"]);
    expect(second.map((entry) => entry.id)).toEqual(first.map((entry) => entry.id));
  });

  it("returns an empty list for an account with no history", () => {
    expect(mergeTimeline([], [])).toEqual([]);
  });

  it("leaves the caller's arrays untouched", () => {
    const inquiries = [inquiry({ at: 1 }), inquiry({ id: "inq-2", at: 9 })];
    mergeTimeline(inquiries, []);

    expect(inquiries.map((entry) => entry.id)).toEqual(["inq-1", "inq-2"]);
  });
});

describe("summariseValue", () => {
  it("banks only completed orders", () => {
    const value = summariseValue([
      order({ id: "a", status: "COMPLETED", totalAmount: 300 }),
      order({ id: "b", status: "COMPLETED", totalAmount: 200 }),
    ]);

    expect(value).toEqual({ earned: 500, open: 0, completedCount: 2, openCount: 0 });
  });

  it("counts orders still in flight apart from the ones that closed", () => {
    const value = summariseValue([
      order({ id: "a", status: "COMPLETED", totalAmount: 100 }),
      order({ id: "b", status: "DRAFT", totalAmount: 40 }),
      order({ id: "c", status: "PENDING", totalAmount: 60 }),
      order({ id: "d", status: "CONFIRMED", totalAmount: 10 }),
    ]);

    expect(value).toEqual({ earned: 100, open: 110, completedCount: 1, openCount: 3 });
  });

  it("ignores cancelled orders entirely — they did not happen", () => {
    const value = summariseValue([
      order({ id: "a", status: "CANCELLED", totalAmount: 900 }),
      order({ id: "b", status: "COMPLETED", totalAmount: 100 }),
    ]);

    expect(value).toEqual({ earned: 100, open: 0, completedCount: 1, openCount: 0 });
  });

  it("reports zeroes for an account that has never ordered", () => {
    expect(summariseValue([])).toEqual({
      earned: 0,
      open: 0,
      completedCount: 0,
      openCount: 0,
    });
  });
});
