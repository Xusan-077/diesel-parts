import { describe, expect, it } from "vitest";
import { computeHeaderState, HEADER_SOLID_THRESHOLD } from "./scroll";

describe("computeHeaderState", () => {
  it("stays transparent and visible at or above the top of the page", () => {
    expect(computeHeaderState(0, 0)).toEqual({ solid: false, hidden: false });
    expect(computeHeaderState(0, HEADER_SOLID_THRESHOLD)).toEqual({ solid: false, hidden: false });
  });

  it("becomes solid once scrolled past the threshold", () => {
    const state = computeHeaderState(0, HEADER_SOLID_THRESHOLD + 1);
    expect(state.solid).toBe(true);
  });

  it("hides when scrolling down past the threshold", () => {
    expect(computeHeaderState(100, 150)).toEqual({ solid: true, hidden: true });
  });

  it("reveals when scrolling up, even while still past the threshold", () => {
    expect(computeHeaderState(150, 100)).toEqual({ solid: true, hidden: false });
  });

  it("returns to transparent and visible when scrolling back above the threshold", () => {
    expect(computeHeaderState(100, HEADER_SOLID_THRESHOLD - 5)).toEqual({ solid: false, hidden: false });
  });
});
