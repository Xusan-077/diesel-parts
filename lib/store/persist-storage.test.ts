import { describe, expect, it } from "vitest";
import { parseCart } from "./cart";
import { parseIdList } from "./collection";
import { normalizePersistedValue } from "./persist-storage";

describe("normalizePersistedValue", () => {
  it("passes through the zustand envelope", () => {
    const raw = JSON.stringify({ state: { items: [{ productId: "p1", quantity: 2 }] }, version: 0 });
    expect(normalizePersistedValue(raw, "items")).toEqual({
      state: { items: [{ productId: "p1", quantity: 2 }] },
    });
  });

  it("wraps a bare array from the pre-zustand format", () => {
    const raw = JSON.stringify(["a", "b"]);
    expect(normalizePersistedValue(raw, "ids")).toEqual({ state: { ids: ["a", "b"] } });
  });

  it("returns null when nothing is stored", () => {
    expect(normalizePersistedValue(null, "items")).toBeNull();
  });

  it("returns null for corrupt JSON", () => {
    expect(normalizePersistedValue("{not json", "items")).toBeNull();
  });

  it("returns null for an object without a usable state", () => {
    expect(normalizePersistedValue(JSON.stringify({ nope: 1 }), "items")).toBeNull();
    expect(normalizePersistedValue(JSON.stringify({ state: 5 }), "items")).toBeNull();
    expect(normalizePersistedValue(JSON.stringify("string"), "items")).toBeNull();
  });
});

describe("normalizePersistedValue feeding the parsers", () => {
  function readCart(raw: string | null) {
    const envelope = normalizePersistedValue(raw, "items");
    return parseCart(envelope?.state.items);
  }

  it("recovers a legacy bare-array cart", () => {
    const legacy = [{ productId: "p1", quantity: 2 }];
    expect(readCart(JSON.stringify(legacy))).toEqual(legacy);
  });

  it("recovers a zustand-written cart", () => {
    const stored = { state: { items: [{ productId: "p1", quantity: 3 }] }, version: 0 };
    expect(readCart(JSON.stringify(stored))).toEqual([{ productId: "p1", quantity: 3 }]);
  });

  it("drops junk entries while keeping valid ones", () => {
    const messy = [{ productId: "p1", quantity: 2 }, { productId: 5 }, "nope"];
    expect(readCart(JSON.stringify(messy))).toEqual([{ productId: "p1", quantity: 2 }]);
  });

  it("yields an empty list for corrupt storage", () => {
    expect(readCart("{broken")).toEqual([]);
    const envelope = normalizePersistedValue("{broken", "ids");
    expect(parseIdList(envelope?.state.ids)).toEqual([]);
  });
});
