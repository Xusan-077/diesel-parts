/** Pure helpers for the wishlist and compare lists, which are plain id lists. */

export function hasId(ids: readonly string[], id: string): boolean {
  return ids.includes(id);
}

/**
 * Appends the id unless it is already present. When `max` is reached the list
 * is returned unchanged — the caller decides how to surface the limit.
 */
export function addId(ids: readonly string[], id: string, max?: number): string[] {
  if (hasId(ids, id)) {
    return [...ids];
  }
  if (max !== undefined && ids.length >= max) {
    return [...ids];
  }
  return [...ids, id];
}

export function removeId(ids: readonly string[], id: string): string[] {
  return ids.filter((current) => current !== id);
}

export function toggleId(ids: readonly string[], id: string, max?: number): string[] {
  return hasId(ids, id) ? removeId(ids, id) : addId(ids, id, max);
}

/** Accepts anything read back from localStorage and returns a clean id list. */
export function parseIdList(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const seen = new Set<string>();
  for (const entry of raw) {
    if (typeof entry === "string" && entry.length > 0) {
      seen.add(entry);
    }
  }
  return [...seen];
}
