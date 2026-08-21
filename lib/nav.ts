import type { Dictionary } from "@/lib/i18n/dictionaries";

export interface NavItem {
  href: string;
  label: string;
}

/**
 * Links rendered in the third header row and mirrored in the mobile drawer.
 *
 * The hrefs carry no locale any more — one address per page, with the language
 * chosen by the store — so only the labels still depend on the dictionary.
 */
export function buildMainNav(nav: Dictionary["nav"]): NavItem[] {
  return [
    { href: "/products", label: nav.allProducts },
    { href: "/brands", label: nav.brands },
    { href: "/partnership", label: nav.partnership },
    { href: "/services", label: nav.services },
    { href: "/delivery", label: nav.delivery },
    { href: "/payment", label: nav.payment },
    { href: "/about", label: nav.about },
    { href: "/contact", label: nav.contacts },
  ];
}

export type HeaderActionKey = "compare" | "favorites" | "cart" | "account";

export interface HeaderActionItem extends NavItem {
  key: HeaderActionKey;
}

/** The icon links on the right of the second header row. */
export function buildHeaderActions(header: Dictionary["header"]): HeaderActionItem[] {
  return [
    { key: "compare", href: "/compare", label: header.compare },
    { key: "favorites", href: "/wishlist", label: header.favorites },
    { key: "cart", href: "/cart", label: header.cart },
    { key: "account", href: "/account", label: header.account },
  ];
}

export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
