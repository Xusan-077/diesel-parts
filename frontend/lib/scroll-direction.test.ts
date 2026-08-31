import { describe, expect, it } from "vitest";
import {
  DEFAULT_SCROLL_THRESHOLDS,
  INITIAL_SCROLL_STATE,
  isHeaderCondensed,
  readScroll,
  type ScrollState,
} from "./scroll-direction";

const { offset, threshold } = DEFAULT_SCROLL_THRESHOLDS;

/** Replays a series of scroll positions the way the hook does. */
function replay(positions: readonly number[]): ScrollState {
  let state = INITIAL_SCROLL_STATE;
  let anchor = 0;
  for (const y of positions) {
    ({ state, anchor } = readScroll(state, anchor, y));
  }
  return state;
}

describe("readScroll", () => {
  it("starts at the top facing up", () => {
    expect(replay([])).toEqual({ direction: "up", atTop: true });
  });

  it("registers a downward move past the threshold", () => {
    expect(replay([offset + 200])).toEqual({ direction: "down", atTop: false });
  });

  it("registers the way back up", () => {
    expect(replay([offset + 200, offset + 40])).toEqual({
      direction: "up",
      atTop: false,
    });
  });

  it("is back at the top within the offset", () => {
    expect(replay([offset + 200, 0]).atTop).toBe(true);
  });

  it("ignores movement smaller than the threshold", () => {
    const state = replay([offset + 200, offset + 200 - (threshold - 1)]);
    expect(state.direction).toBe("down");
  });

  it("adds sub-threshold movement up rather than discarding it", () => {
    // Five nudges of 3px are noise one at a time but a real 15px move together.
    const start = offset + 200;
    const creep = [start, start - 3, start - 6, start - 9, start - 12, start - 15];
    expect(replay(creep).direction).toBe("up");
  });

  it("returns the previous state by identity when nothing changed", () => {
    const first = readScroll(INITIAL_SCROLL_STATE, 0, offset + 200);
    const second = readScroll(first.state, first.anchor, first.anchor + 200);
    const third = readScroll(second.state, second.anchor, second.anchor + 200);

    expect(third.state).toBe(second.state);
  });

  it("keeps the anchor put while a sample is below the threshold", () => {
    const sample = readScroll(INITIAL_SCROLL_STATE, 400, 400 + threshold - 1);
    expect(sample.anchor).toBe(400);
  });

  it("treats iOS rubber-band overscroll as the top of the page", () => {
    expect(replay([offset + 200, -120]).atTop).toBe(true);
  });
});

describe("isHeaderCondensed", () => {
  it("keeps the full header at the top of the page", () => {
    expect(isHeaderCondensed({ direction: "down", atTop: true })).toBe(false);
  });

  it("condenses once the visitor reads downwards", () => {
    expect(isHeaderCondensed({ direction: "down", atTop: false })).toBe(true);
  });

  it("restores the full header on the way back up", () => {
    expect(isHeaderCondensed({ direction: "up", atTop: false })).toBe(false);
  });
});
