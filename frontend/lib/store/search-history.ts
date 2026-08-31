/** Pure helpers for the header search's recent-terms list. */

/** Rows are a shortcut, not a log — eight is plenty to recognise at a glance. */
export const MAX_SEARCH_HISTORY = 8;

/**
 * Adds a term to the front of the list, most recent first.
 *
 * Case-insensitive de-duplication: re-running "CAT" after "cat" moves the one
 * entry to the front rather than keeping both, which would read as two
 * different searches when they matched the same rows.
 */
export function addSearchTerm(terms: readonly string[], term: string): string[] {
  const trimmed = term.trim();
  if (!trimmed) {
    return [...terms];
  }
  const key = trimmed.toLowerCase();
  const withoutDuplicate = terms.filter((existing) => existing.toLowerCase() !== key);
  return [trimmed, ...withoutDuplicate].slice(0, MAX_SEARCH_HISTORY);
}

/** Accepts anything read back from localStorage and returns a clean term list. */
export function parseSearchHistory(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of raw) {
    if (result.length >= MAX_SEARCH_HISTORY) {
      break;
    }
    if (typeof entry !== "string") {
      continue;
    }
    const trimmed = entry.trim();
    if (!trimmed) {
      continue;
    }
    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}
