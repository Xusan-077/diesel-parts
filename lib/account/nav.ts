/**
 * The cabinet's menu, as data.
 *
 * Three kinds of entry live side by side in one list, because to the visitor
 * they are one list: a `section` swaps the panel beside the menu, a `link`
 * leaves for a page that already exists elsewhere on the site, and `logout` is
 * an action. Splitting them into three arrays would only push the interleaving
 * back into the markup, and the order below is the order in the design.
 */

export const ACCOUNT_SECTIONS = [
  "details",
  "orders",
  "reviews",
  "addresses",
  "notifications",
] as const;

export type AccountSection = (typeof ACCOUNT_SECTIONS)[number];

export type AccountNavItem =
  | { id: AccountSection; kind: "section" }
  | { id: "wishlist" | "support"; kind: "link"; href: string }
  | { id: "logout"; kind: "logout" };

/** Every id in the menu, which is also every key the dictionary must carry. */
export type AccountNavId = AccountNavItem["id"];

export const ACCOUNT_NAV: readonly AccountNavItem[] = [
  { id: "details", kind: "section" },
  { id: "orders", kind: "section" },
  { id: "wishlist", kind: "link", href: "/wishlist" },
  { id: "reviews", kind: "section" },
  { id: "addresses", kind: "section" },
  { id: "notifications", kind: "section" },
  { id: "support", kind: "link", href: "/contact" },
  { id: "logout", kind: "logout" },
];

export const DEFAULT_ACCOUNT_SECTION: AccountSection = "details";

export function isAccountSection(value: string): value is AccountSection {
  return (ACCOUNT_SECTIONS as readonly string[]).includes(value);
}

/**
 * Reads the section out of `?tab=`, so a menu choice survives a refresh and
 * can be linked to. Anything unrecognised falls back rather than erroring —
 * a hand-edited query string is not a reason to show an empty screen.
 */
export function resolveAccountSection(value: string | null | undefined): AccountSection {
  return typeof value === "string" && isAccountSection(value) ? value : DEFAULT_ACCOUNT_SECTION;
}
