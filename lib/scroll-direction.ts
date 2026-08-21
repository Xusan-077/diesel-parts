/**
 * Pure scroll bookkeeping for the collapsing header.
 *
 * Kept out of the hook so the hysteresis — the part that is easy to get wrong
 * and impossible to eyeball — can be tested without a browser. The hook is
 * then only an event listener and a `useState`.
 */

export type ScrollDirection = "up" | "down";

export interface ScrollState {
  /** The last movement large enough to count. Starts as "up". */
  direction: ScrollDirection;
  /** Still within `offset` of the top of the page. */
  atTop: boolean;
}

export interface ScrollThresholds {
  /** Pixels from the top of the page that still count as being at the top. */
  offset: number;
  /**
   * Smallest movement that may flip the direction. Below it the sample is
   * treated as noise, so a trackpad wobble or the browser's own scroll
   * anchoring cannot make the header flicker.
   */
  threshold: number;
}

export const DEFAULT_SCROLL_THRESHOLDS: ScrollThresholds = {
  // Roughly the top bar's own height: the header only starts collapsing once
  // that row would have scrolled away anyway.
  offset: 80,
  threshold: 8,
};

export const INITIAL_SCROLL_STATE: ScrollState = { direction: "up", atTop: true };

export interface ScrollSample {
  state: ScrollState;
  /**
   * The position the *next* sample is measured against. It only moves when a
   * sample cleared the threshold, so a slow drag still adds up to a flip
   * instead of being discarded one pixel at a time.
   */
  anchor: number;
}

/**
 * Folds one scroll position into the header state.
 *
 * `state` is returned by identity when nothing meaningful changed, so the hook
 * can hand it straight to `setState` and React will skip the re-render.
 */
export function readScroll(
  previous: ScrollState,
  anchor: number,
  y: number,
  thresholds: ScrollThresholds = DEFAULT_SCROLL_THRESHOLDS
): ScrollSample {
  // Rubber-band overscroll reports negative values on iOS.
  const position = Math.max(0, y);
  const delta = position - anchor;
  const moved = Math.abs(delta) >= thresholds.threshold;

  const direction = moved ? (delta > 0 ? "down" : "up") : previous.direction;
  const atTop = position <= thresholds.offset;

  const state =
    direction === previous.direction && atTop === previous.atTop
      ? previous
      : { direction, atTop };

  return { state, anchor: moved ? position : anchor };
}

/**
 * The top bar is only worth hiding while the visitor is reading *downwards*.
 * Scrolling back up is almost always a move towards the navigation, so the
 * full header returns before they reach the top of the page.
 */
export function isHeaderCondensed(state: ScrollState): boolean {
  return !state.atTop && state.direction === "down";
}
