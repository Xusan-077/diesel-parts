/**
 * The rules behind the small gallery inside a catalog card.
 *
 * Separate from the component because "which frame is showing" is the part
 * that goes wrong — off-by-one at the ends, a stale index after the product
 * changes — and none of it needs a DOM to check.
 */

/**
 * Whether the gallery is worth any controls at all.
 *
 * One frame is a picture, not a gallery: dots under it would be a control that
 * does nothing, and an arrow that cannot move is worse than no arrow.
 */
export function isBrowsable(frames: readonly unknown[]): boolean {
  return frames.length > 1;
}

/**
 * The next frame in a given direction.
 *
 * Wraps, because the card is a browse surface: someone flicking through three
 * photographs of a fuel injector should not hit a wall on the third and have to
 * flick back. The page's own gallery is where you go to study one frame.
 */
export function stepFrame(active: number, count: number, delta: 1 | -1): number {
  if (count <= 0) {
    return 0;
  }
  return (active + delta + count) % count;
}

/**
 * Reads a swipe as a frame change, or as nothing.
 *
 * `null` means the gesture was not a swipe — too short, or mostly vertical,
 * which is the page being scrolled past a card rather than a card being
 * browsed. Getting that second test wrong is what makes a grid of cards
 * impossible to scroll on a phone.
 */
export function swipeDelta(dx: number, dy: number): 1 | -1 | null {
  const MIN_DISTANCE = 32;

  if (Math.abs(dx) < MIN_DISTANCE || Math.abs(dx) <= Math.abs(dy)) {
    return null;
  }
  // Dragging left pulls the next frame in, as a scroll track would.
  return dx < 0 ? 1 : -1;
}

/** Keeps an index inside a list that may have changed under it. */
export function clampFrame(active: number, count: number): number {
  if (count <= 0) {
    return 0;
  }
  return Math.min(Math.max(0, active), count - 1);
}
