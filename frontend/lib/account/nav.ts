/**
 * The cabinet's menu, as data.
 *
 * Every section is a route of its own under `/account`, so a visitor can link
 * to their saved products, open them in a new tab, and use the back button
 * between the menu's choices. It used to be React state — one page swapping
 * panels beside the menu — which meant "Saralanganlar" had no address, and
 * the only way to reach that list was a link that left the cabinet for the
 * standalone /wishlist page.
 *
 * Two kinds of entry live side by side in one list, because to the visitor
 * they are one list: a `section` is a page inside the cabinet, a `link` leaves
 * for a page elsewhere on the site, and `logout` is an action. Splitting them
 * into three arrays would only push the interleaving back into the markup, and
 * the order below is the order in the design.
 */

/** The cabinet's own root. `details` is served here rather than at a slug. */
export const ACCOUNT_ROOT = "/account";

export const ACCOUNT_SECTIONS = [
  "details",
  "orders",
  "wishlist",
  "reviews",
  "addresses",
  "notifications",
] as const;

export type AccountSection = (typeof ACCOUNT_SECTIONS)[number];

/**
 * The sections that have nothing behind them yet and show a placeholder.
 * `details` and `wishlist` are the two that render real content, and the
 * dictionary's `profilePanel.empty` carries a line for exactly the rest — the
 * type is what keeps those two lists in step.
 */
export type AccountPlaceholderSection = Exclude<AccountSection, "details" | "wishlist">;

export type AccountNavItem =
  | { id: AccountSection; kind: "section"; href: string }
  | { id: "support"; kind: "link"; href: string }
  | { id: "logout"; kind: "logout" };

/** Every id in the menu, which is also every key the dictionary must carry. */
export type AccountNavId = AccountNavItem["id"];

/** The route each section is served at. */
export function accountSectionHref(section: AccountSection): string {
  return section === DEFAULT_ACCOUNT_SECTION ? ACCOUNT_ROOT : `${ACCOUNT_ROOT}/${section}`;
}

export const DEFAULT_ACCOUNT_SECTION: AccountSection = "details";

export const ACCOUNT_NAV: readonly AccountNavItem[] = [
  { id: "details", kind: "section", href: accountSectionHref("details") },
  { id: "orders", kind: "section", href: accountSectionHref("orders") },
  { id: "wishlist", kind: "section", href: accountSectionHref("wishlist") },
  { id: "reviews", kind: "section", href: accountSectionHref("reviews") },
  { id: "addresses", kind: "section", href: accountSectionHref("addresses") },
  { id: "notifications", kind: "section", href: accountSectionHref("notifications") },
  { id: "support", kind: "link", href: "/contact" },
  { id: "logout", kind: "logout" },
];

export function isAccountSection(value: string): value is AccountSection {
  return (ACCOUNT_SECTIONS as readonly string[]).includes(value);
}

/**
 * Which menu row the current URL belongs to, for the active mark.
 *
 * Anything that is not a section's own route — the cabinet root, a trailing
 * slash, a hand-typed slug — reads as the default rather than as "no row
 * selected": the menu always has one row lit, and an unrecognised slug is a
 * 404 from the router long before it reaches this.
 */
export function accountSectionFromPath(pathname: string | null | undefined): AccountSection {
  if (typeof pathname !== "string") {
    return DEFAULT_ACCOUNT_SECTION;
  }

  const trimmed = pathname.replace(/\/+$/, "");
  const slug = trimmed.startsWith(`${ACCOUNT_ROOT}/`)
    ? trimmed.slice(ACCOUNT_ROOT.length + 1)
    : "";

  // `details` is served at the root, so its own slug is not a route and must
  // not light the row from a URL that does not exist.
  return slug !== DEFAULT_ACCOUNT_SECTION && isAccountSection(slug)
    ? slug
    : DEFAULT_ACCOUNT_SECTION;
}
