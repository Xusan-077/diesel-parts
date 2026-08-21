import { describe, expect, it } from "vitest";
import { clampFrame, isBrowsable, stepFrame, swipeDelta } from "./card-gallery";

describe("isBrowsable", () => {
  it("is not a gallery with nothing, or with one frame", () => {
    expect(isBrowsable([])).toBe(false);
    expect(isBrowsable(["Front"])).toBe(false);
  });

  it("is a gallery from two frames up", () => {
    expect(isBrowsable(["Front", "Side"])).toBe(true);
  });
});

describe("stepFrame", () => {
  it("walks forwards and back", () => {
    expect(stepFrame(0, 3, 1)).toBe(1);
    expect(stepFrame(2, 3, -1)).toBe(1);
  });

  it("wraps at both ends rather than stopping", () => {
    expect(stepFrame(2, 3, 1)).toBe(0);
    expect(stepFrame(0, 3, -1)).toBe(2);
  });

  it("has nowhere to go with no frames", () => {
    expect(stepFrame(0, 0, 1)).toBe(0);
  });

  it("returns to where it started after a full lap", () => {
    let active = 0;
    for (let step = 0; step < 3; step += 1) {
      active = stepFrame(active, 3, 1);
    }
    expect(active).toBe(0);
  });
});

describe("swipeDelta", () => {
  it("reads a decisive horizontal drag", () => {
    expect(swipeDelta(-60, 4)).toBe(1);
    expect(swipeDelta(60, 4)).toBe(-1);
  });

  it("ignores a drag too short to be meant", () => {
    expect(swipeDelta(-20, 0)).toBeNull();
  });

  it("ignores a vertical drag, which is the page being scrolled", () => {
    // A grid of cards has to stay scrollable on a phone; this is that test.
    expect(swipeDelta(-40, 90)).toBeNull();
    expect(swipeDelta(-40, 40)).toBeNull();
  });
});

describe("clampFrame", () => {
  it("keeps an index inside a list that shrank under it", () => {
    expect(clampFrame(5, 3)).toBe(2);
    expect(clampFrame(-1, 3)).toBe(0);
  });

  it("is zero when there is nothing to point at", () => {
    expect(clampFrame(2, 0)).toBe(0);
  });
});
