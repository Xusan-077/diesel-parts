import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";

export interface NavItem {
  href: string;
  label: string;
}

/** Links rendered in the third header row and mirrored in the mobile drawer. */
export function buildMainNav(lang: Locale, nav: Dictionary["nav"]): NavItem[] {
  return [
    { href: `/${lang}/products`, label: nav.allProducts },
    { href: `/${lang}/brands`, label: nav.brands },
    { href: `/${lang}/partnership`, label: nav.partnership },
    { href: `/${lang}/services`, label: nav.services },
    { href: `/${lang}/delivery`, label: nav.delivery },
    { href: `/${lang}/payment`, label: nav.payment },
    { href: `/${lang}/about`, label: nav.about },
    { href: `/${lang}/contact`, label: nav.contacts },
  ];
}

export type HeaderActionKey = "compare" | "favorites" | "cart" | "account";

export interface HeaderActionItem extends NavItem {
  key: HeaderActionKey;
}

/** The icon links on the right of the second header row. */
export function buildHeaderActions(
  lang: Locale,
  header: Dictionary["header"]
): HeaderActionItem[] {
  return [
    { key: "compare", href: `/${lang}/compare`, label: header.compare },
    { key: "favorites", href: `/${lang}/wishlist`, label: header.favorites },
    { key: "cart", href: `/${lang}/cart`, label: header.cart },
    { key: "account", href: `/${lang}/account`, label: header.account },
  ];
}

export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
