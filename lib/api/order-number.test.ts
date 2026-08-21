import { describe, expect, it } from "vitest";
import { formatOrderNumber, nextOrderNumber, parseOrderNumber } from "./order-number";

describe("parseOrderNumber", () => {
  it("reads the year and sequence back out", () => {
    expect(parseOrderNumber("DP-2026-0042")).toEqual({ year: 2026, sequence: 42 });
  });

  it("rejects anything not of the form DP-<year>-<digits>", () => {
    expect(parseOrderNumber("DP-2026")).toBeNull();
    expect(parseOrderNumber("XX-2026-0001")).toBeNull();
    expect(parseOrderNumber("DP-26-0001")).toBeNull();
    expect(parseOrderNumber("")).toBeNull();
  });
});

describe("formatOrderNumber", () => {
  it("pads the sequence to four digits", () => {
    expect(formatOrderNumber(2026, 42)).toBe("DP-2026-0042");
    expect(formatOrderNumber(2026, 1)).toBe("DP-2026-0001");
  });

  it("keeps going past four digits rather than truncating", () => {
    expect(formatOrderNumber(2026, 10_000)).toBe("DP-2026-10000");
  });
});

describe("nextOrderNumber", () => {
  it("starts the year at 0001 when nothing has been issued", () => {
    expect(nextOrderNumber(null, 2026)).toBe("DP-2026-0001");
  });

  it("increments the latest number of the same year", () => {
    expect(nextOrderNumber("DP-2026-0041", 2026)).toBe("DP-2026-0042");
  });

  it("restarts the sequence at a new year", () => {
    expect(nextOrderNumber("DP-2026-0999", 2027)).toBe("DP-2027-0001");
  });

  it("starts the year rather than failing on a malformed latest value", () => {
    // A reference is a label. Refusing to write an order because an old one
    // was hand-edited would be the worse outcome.
    expect(nextOrderNumber("not-an-order-number", 2026)).toBe("DP-2026-0001");
  });

  it("rolls over the padding width", () => {
    expect(nextOrderNumber("DP-2026-9999", 2026)).toBe("DP-2026-10000");
  });
});
