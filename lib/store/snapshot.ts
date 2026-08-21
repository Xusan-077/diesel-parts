import type { Locale } from "@/lib/i18n/locales";
import type { ResolvedProduct } from "@/lib/product-lookup";

/**
 * The catalog rows the cart, wishlist and compare lists were built from, kept
 * beside the id lists in localStorage.
 *
 * The lists themselves have always been local; what was not was the *content*.
 * Opening the cart meant an id list, a request to `/api/products/by-ids` and a
 * skeleton until it answered — so a cart the browser already held in full could
 * not be drawn without the network. These snapshots are what the page paints
 * immediately; the request still runs behind them, because a price or a stock
 * badge from last week is worse than a moment's wait, and its answer replaces
 * the snapshot and refreshes it.
 *
 * `lang` is stored because `brandName` and `categoryName` arrive already
 * translated. A snapshot taken in Uzbek is not a snapshot for the Russian page.
 */
export interface StoredSnapshot {
  lang: Locale;
  entry: ResolvedProduct;
  /** Insertion order, and the only thing eviction looks at. */
  seq: number;
}

export type SnapshotMap = Record<string, StoredSnapshot>;

/**
 * Snapshots outlive the list that created them — removing a line should not
 * cost a refetch if it goes back in — so the cache is bounded by count rather
 * than by membership. Well above any realistic cart, well below the point
 * where localStorage starts to hurt.
 */
export const MAX_SNAPSHOTS = 120;

function highestSeq(current: SnapshotMap): number {
  let max = 0;
  for (const stored of Object.values(current)) {
    if (stored.seq > max) {
      max = stored.seq;
    }
  }
  return max;
}

/** Keeps the `limit` most recently written entries. */
function evict(map: SnapshotMap, limit: number): SnapshotMap {
  const entries = Object.entries(map);
  if (entries.length <= limit) {
    return map;
  }
  entries.sort((a, b) => b[1].seq - a[1].seq);
  return Object.fromEntries(entries.slice(0, limit));
}

export function recordSnapshots(
  current: SnapshotMap,
  entries: readonly ResolvedProduct[],
  lang: Locale,
  limit: number = MAX_SNAPSHOTS
): SnapshotMap {
  if (entries.length === 0) {
    return current;
  }

  let seq = highestSeq(current);
  const next: SnapshotMap = { ...current };
  for (const entry of entries) {
    seq += 1;
    next[entry.product.id] = { lang, entry, seq };
  }

  return evict(next, limit);
}

/**
 * The cached rows for `ids`, in that order — or `null` when even one of them
 * is missing or was captured in another language.
 *
 * All or nothing on purpose: a cart that draws three of its four lines and
 * then reflows when the fourth arrives is worse than one that waits, and the
 * wait only ever happens for a list that was never resolved on this device.
 */
export function readSnapshots(
  current: SnapshotMap,
  ids: readonly string[],
  lang: Locale
): ResolvedProduct[] | null {
  const found: ResolvedProduct[] = [];
  for (const id of ids) {
    const stored = current[id];
    if (stored === undefined || stored.lang !== lang) {
      return null;
    }
    found.push(stored.entry);
  }
  return found;
}

export function forgetSnapshot(current: SnapshotMap, id: string): SnapshotMap {
  if (!(id in current)) {
    return current;
  }
  const next = { ...current };
  delete next[id];
  return next;
}

/** Accepts anything read back from localStorage and returns a clean map. */
export function parseSnapshots(raw: unknown): SnapshotMap {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }

  const map: SnapshotMap = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === null || typeof value !== "object") {
      continue;
    }
    const { lang, entry, seq } = value as Partial<StoredSnapshot>;
    if (typeof lang !== "string" || typeof seq !== "number") {
      continue;
    }
    // Only the identity is checked. A snapshot is display-only and is replaced
    // the moment the catalog answers, so a field the schema has since dropped
    // costs a blank caption for one paint, not a crash.
    if (
      entry === undefined ||
      typeof entry !== "object" ||
      typeof entry.product?.id !== "string" ||
      entry.product.id !== id
    ) {
      continue;
    }
    map[id] = { lang: lang as Locale, entry, seq };
  }

  return map;
}
