/**
 * Whether the sidebar is open or folded to a 72px rail of glyphs.
 *
 * Not a zustand store, unlike the theme and the accent. Those two are read by
 * components that render text from them; this one is read by CSS — the width,
 * the folded labels and the chevron direction are all attribute selectors in
 * globals.css. Putting it in a store as well would give the same fact two
 * homes and one of them would eventually be stale.
 *
 * React still mirrors the attribute after mount, for `aria-expanded` and for
 * the toggle's label. It does not own it.
 */
export type Rail = "expanded" | "collapsed";

export const DEFAULT_RAIL: Rail = "expanded";

export const RAIL_STORAGE_KEY = "panel-rail";

/** The attribute the CSS keys off, on `<html>`. */
export const RAIL_ATTRIBUTE = "data-rail";

export function parseRail(value: unknown): Rail {
  return value === "collapsed" ? "collapsed" : DEFAULT_RAIL;
}

/** Reads what the pre-paint script already stamped, so the two never disagree. */
export function readRail(root: HTMLElement = document.documentElement): Rail {
  return parseRail(root.getAttribute(RAIL_ATTRIBUTE));
}

/**
 * The attribute is the store, so React subscribes to it rather than keeping a
 * second copy.
 *
 * `useSyncExternalStore` is the shape React offers for exactly this: a value
 * that lives outside React, has a different answer on the server than in the
 * browser, and must not be read during render. Mirroring it into `useState`
 * from an effect would work and would also mean two sources of truth for the
 * width of the sidebar, which is how they end up disagreeing.
 */
const listeners = new Set<() => void>();

export function subscribeRail(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The browser's answer. Returns a literal, so React can compare it by value. */
export function railSnapshot(): Rail {
  return readRail();
}

/** The server has no DOM and no storage; every render starts open. */
export function railServerSnapshot(): Rail {
  return DEFAULT_RAIL;
}

/** Writes both copies at once: the attribute the CSS reads, and the stored one. */
export function applyRail(rail: Rail, root: HTMLElement = document.documentElement): void {
  root.setAttribute(RAIL_ATTRIBUTE, rail);
  try {
    localStorage.setItem(RAIL_STORAGE_KEY, rail);
  } catch {
    // A browser with storage blocked keeps the choice for this page only,
    // which is a better outcome than a toggle that throws.
  }

  for (const listener of listeners) {
    listener();
  }
}

/**
 * The blocking half. Runs before any bundle is parsed so the rail is already
 * the right width at the first paint — the alternative is a 264px sidebar that
 * snaps to 72px once hydration lands, on every single navigation.
 */
export function railInitScript(): string {
  const key = JSON.stringify(RAIL_STORAGE_KEY);
  const attribute = JSON.stringify(RAIL_ATTRIBUTE);
  const fallback = JSON.stringify(DEFAULT_RAIL);

  return `(function(){try{var r=localStorage.getItem(${key});document.documentElement.setAttribute(${attribute},r==="collapsed"?"collapsed":${fallback})}catch(e){}})()`;
}
