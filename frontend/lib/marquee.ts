/**
 * The two numbers behind a seamless marquee belt.
 *
 * Kept out of the hook because they are the only part of it that can be
 * reasoned about without a browser: everything else in `useInfiniteMarquee` is
 * refs, observers and a frame loop.
 */

/**
 * Where the belt sits after `deltaMs` at `pxPerSecond`, folded back into a
 * single copy's width.
 *
 * The track holds the same cards twice, so translating by exactly one copy
 * puts the second copy where the first stood — pixel for pixel, mid-frame,
 * with nothing to see. Folding the offset back at that point is what makes the
 * loop infinite instead of a track that eventually runs out.
 *
 * The result is always in `(-period, 0]`, so a belt travelling right (a
 * negative speed) wraps to a negative offset rather than drifting positive and
 * exposing the empty space in front of the first card.
 */
export function advanceOffset(
  offset: number,
  deltaMs: number,
  pxPerSecond: number,
  period: number
): number {
  // A period of zero means nothing has been measured yet — before that there
  // is no wrap point, and translating would only move cards off their marks.
  if (!(period > 0) || !Number.isFinite(deltaMs)) {
    return 0;
  }

  const next = offset - (pxPerSecond * deltaMs) / 1000;
  const wrapped = next % period;
  const folded = wrapped > 0 ? wrapped - period : wrapped;
  // A lap that lands exactly on the seam produces -0, which is the same
  // position but a different number — normalised so callers and tests can
  // compare offsets without meeting a negative zero.
  return folded === 0 ? 0 : folded;
}

/**
 * Whether a belt of this width can loop inside a window of that width.
 *
 * One copy has to be wider than what is on screen. If it is not, the moment
 * the first copy clears the left edge there is nothing behind it yet, and the
 * belt runs with a hole in it. In that case the caller shows a single copy on
 * a plain scroll rail — a short shelf is not worth faking depth for.
 */
export function canLoop(copyWidth: number, viewportWidth: number): boolean {
  return copyWidth > 0 && viewportWidth > 0 && copyWidth > viewportWidth;
}
