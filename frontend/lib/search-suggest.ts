/**
 * The rules behind the header's search suggestions.
 *
 * Kept out of the component for the usual reason: the parts that are easy to
 * get wrong here — when a query is worth a request, where the highlight goes on
 * an arrow key, what Enter means — are pure, and none of them need a DOM.
 */

/**
 * How many suggestions the dropdown offers.
 *
 * Six, because the list is a shortcut and not the catalog. A visitor who does
 * not see their part in six rows is better served by the full results page,
 * which has the filters; a longer list would compete with it and cover the page
 * behind the header on a small screen.
 */
export const SUGGESTION_LIMIT = 6;

/**
 * Shortest query worth a request.
 *
 * One character matches most of the catalog and answers nothing, so the field
 * stays quiet until there are two.
 */
export const MIN_QUERY_LENGTH = 2;

/** Milliseconds of stillness before the request goes out. */
export const SUGGEST_DEBOUNCE_MS = 300;

/** The index meaning "the query itself", i.e. nothing in the list is picked. */
export const NO_SUGGESTION = -1;

export function isSuggestible(query: string): boolean {
  return query.trim().length >= MIN_QUERY_LENGTH;
}

/**
 * Where the arrow keys move the highlight.
 *
 * The cursor runs through the input rather than around the list: down from the
 * last suggestion returns to what was typed, and up from the field jumps to the
 * bottom of the list. That is what makes the typed query recoverable — a loop
 * that only visits the suggestions leaves no way back to it without a mouse.
 */
export function moveActive(active: number, count: number, delta: 1 | -1): number {
  if (count === 0) {
    return NO_SUGGESTION;
  }

  // Positions run [-1, 0 … count-1]; shifting by one makes that a plain modulo.
  const positions = count + 1;
  const shifted = (active + 1 + delta + positions) % positions;
  return shifted - 1;
}

/** The full results page for a query — where Enter and "see all" both land. */
export function searchResultsHref(query: string): string {
  const trimmed = query.trim();
  return trimmed ? `/products?q=${encodeURIComponent(trimmed)}` : "/products";
}

export function productHref(slug: string): string {
  return `/products/${slug}`;
}
