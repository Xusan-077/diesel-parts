import { normalizePersistedValue, type PersistedEnvelope } from "@/lib/store/persist-storage";

/**
 * The accent sets a director can repaint the panel with.
 *
 * Named the way a workshop names a paint code — for the system the colour
 * belongs to, not for the colour word — because "blue" says nothing about a
 * diesel panel and "Havo" (air/hydraulic) says which line it came off.
 *
 * The values themselves live in app/globals.css under `[data-accent=…]`. This
 * module owns only the identifier, the label and the swatch, so nothing here
 * has to be kept in step with a hex value in two places: the swatch is drawn
 * from the same custom properties the set defines.
 */
export const ACCENTS = [
  { id: "orange", label: "Brend", code: "DP-01" },
  { id: "blue", label: "Havo", code: "DP-02" },
  { id: "green", label: "Sovutgich", code: "DP-03" },
  { id: "violet", label: "Siyoh", code: "DP-04" },
  { id: "teal", label: "Bosim", code: "DP-05" },
] as const;

export type Accent = (typeof ACCENTS)[number]["id"];

/*
 * The brand red — the storefront's own accent. No `[data-accent]` block: it is
 * what `:root` already is.
 *
 * The identifier is still `orange` because it is the string sitting in every
 * director's localStorage under `panel-accent`, and renaming it would read as
 * an unrecognised value and silently reset their choice. The label has always
 * been "Brend", which is what it still is.
 */
export const DEFAULT_ACCENT: Accent = "orange";

export const ACCENT_STORAGE_KEY = "panel-accent";

/** The attribute the CSS sets key off, on `<html>`. */
export const ACCENT_ATTRIBUTE = "data-accent";

const IDS: readonly string[] = ACCENTS.map((accent) => accent.id);

export function isAccent(value: unknown): value is Accent {
  return typeof value === "string" && IDS.includes(value);
}

/** Anything unrecognised — a cleared store, a hand-edited value — reads as brand. */
export function parseAccent(value: unknown): Accent {
  return isAccent(value) ? value : DEFAULT_ACCENT;
}

/**
 * Tolerates a bare `"blue"` as well as the persist envelope, for the same
 * reason the theme store does: a value written before this store existed, or
 * by hand in devtools, should not silently reset the choice.
 */
export function normalizePersistedAccent(raw: string | null): PersistedEnvelope | null {
  if (isAccent(raw)) {
    return { state: { accent: raw } };
  }

  return normalizePersistedValue(raw, "accent");
}

/** The single place the DOM is touched. */
export function applyAccentAttribute(
  accent: Accent,
  root: HTMLElement = document.documentElement,
): void {
  root.setAttribute(ACCENT_ATTRIBUTE, accent);
}

/**
 * The blocking script that stamps `data-accent` on `<html>` before the first
 * paint, so the chrome never flashes brand orange on its way to the chosen
 * set. It duplicates the reading logic above because it runs before any bundle
 * is parsed; the constants are interpolated rather than retyped so the two
 * cannot drift.
 *
 * Rendered only by the panel's root layout — the marketing site has one brand
 * colour and no picker, so the attribute never reaches it.
 */
export function accentInitScript(): string {
  const key = JSON.stringify(ACCENT_STORAGE_KEY);
  const attribute = JSON.stringify(ACCENT_ATTRIBUTE);
  const ids = JSON.stringify(IDS);
  const fallback = JSON.stringify(DEFAULT_ACCENT);

  return `(function(){try{var o=${ids};var v=function(a){return o.indexOf(a)>-1?a:null};var r=localStorage.getItem(${key});var a=v(r);if(!a&&r){try{var p=JSON.parse(r);a=v(p&&p.state&&p.state.accent)}catch(e){}}document.documentElement.setAttribute(${attribute},a||${fallback})}catch(e){}})()`;
}
