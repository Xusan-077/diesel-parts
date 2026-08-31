import { describe, expect, it } from "vitest";
import { advanceOffset, canLoop } from "./marquee";

/*
 * The belt's whole illusion rests on one identity: translating by exactly one
 * copy's width leaves the row looking untouched, because the second copy is
 * standing where the first one was. Everything here pins that identity down,
 * because the failure it prevents — a visible jerk once a lap — happens a
 * minute into a page nobody is watching in a test run.
 */

describe("advanceOffset", () => {
  it("carries the belt left at the speed it was given", () => {
    // 100 px/s for a quarter second is 25px, and left is negative.
    expect(advanceOffset(0, 250, 100, 1000)).toBe(-25);
  });

  it("folds a full lap back to where it started", () => {
    // One period of travel is indistinguishable from none.
    expect(advanceOffset(0, 1000, 500, 500)).toBe(0);
  });

  it("never returns an offset outside one lap, however long it ran", () => {
    // An hour at 60px/s is 216,000px — the belt must not be translated by it.
    const offset = advanceOffset(0, 3_600_000, 60, 400);
    expect(offset).toBeGreaterThan(-400);
    expect(offset).toBeLessThanOrEqual(0);
  });

  it("keeps a rightward belt behind its start rather than in front of it", () => {
    /*
     * A negative speed travels right. Left unfolded, the offset would go
     * positive and drag the first card away from the left edge, exposing the
     * empty space the second copy is supposed to be filling.
     */
    const offset = advanceOffset(0, 500, -100, 400);
    expect(offset).toBe(-350);
  });

  it("stays put until something has been measured", () => {
    // No period means no wrap point; translating now only moves cards off
    // their marks and then snaps them back once the measurement lands.
    expect(advanceOffset(0, 1000, 100, 0)).toBe(0);
    expect(advanceOffset(-40, 16, 100, Number.NaN)).toBe(0);
  });
});

describe("canLoop", () => {
  it("accepts a shelf wider than the window it runs in", () => {
    expect(canLoop(1200, 375)).toBe(true);
  });

  /*
   * The case that has to be caught before it is rendered: with a copy no wider
   * than the window, the moment the first copy clears the left edge there is
   * nothing behind it yet and the belt runs with a hole in it. The caller
   * shows one static copy instead.
   */
  it("refuses a shelf that cannot cover the window", () => {
    expect(canLoop(300, 375)).toBe(false);
    expect(canLoop(375, 375)).toBe(false);
  });

  it("refuses anything that has not been measured", () => {
    expect(canLoop(0, 375)).toBe(false);
    expect(canLoop(1200, 0)).toBe(false);
  });
});
