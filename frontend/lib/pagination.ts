/** A rendered pagination slot: a page number, or a gap standing in for a run of them. */
export type PageItem = number | "ellipsis";

function range(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

/**
 * Page numbers to render for `current` out of `total`.
 *
 * The row is a fixed width — first page, last page, a window of `siblings`
 * either side of the current one, and up to two gaps — so the control never
 * reflows as the reader pages through. Fewer pages than slots renders them all
 * with no gaps.
 */
export function getPageItems(current: number, total: number, siblings = 1): PageItem[] {
  if (total < 1) {
    return [];
  }

  // first + last + current + both sibling runs + both gaps
  const maxSlots = 5 + siblings * 2;
  if (total <= maxSlots) {
    return range(1, total);
  }

  const clamped = Math.min(Math.max(current, 1), total);
  const left = Math.max(clamped - siblings, 1);
  const right = Math.min(clamped + siblings, total);

  // A gap is only worth drawing when it hides at least two pages. At `left === 3`
  // it would stand in for page 2 alone, trading a clickable target for nothing.
  // Falling through to the head/tail block instead keeps the slot count fixed.
  const hasLeftGap = left > 3;
  const hasRightGap = right < total - 2;
  const blockSize = 3 + siblings * 2;

  if (!hasLeftGap && hasRightGap) {
    return [...range(1, blockSize), "ellipsis", total];
  }

  if (hasLeftGap && !hasRightGap) {
    return [1, "ellipsis", ...range(total - blockSize + 1, total)];
  }

  return [1, "ellipsis", ...range(left, right), "ellipsis", total];
}
