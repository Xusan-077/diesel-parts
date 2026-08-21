import type { StaffRole } from "./roles";

export interface AdminNavItem {
  href: string;
  label: string;
  /** Roles allowed to see the entry. Mirrors canAccessAdminPath, not a substitute. */
  roles: readonly StaffRole[];
}

/** Directors may open the seller pages, so every seller entry lists them too. */
const SELLER_ROLES: readonly StaffRole[] = ["SELLER", "DIRECTOR"];

/**
 * The panel's navigation, in reading order.
 *
 * Only routes that exist appear here: an entry pointing at a page that has not
 * been built yet reads as a broken panel, not as a roadmap.
 */
export const ADMIN_NAV: readonly AdminNavItem[] = [
  { href: "/admin/director", label: "Ko'rsatkichlar", roles: ["DIRECTOR"] },
  { href: "/admin/director/products", label: "Mahsulotlar", roles: ["DIRECTOR"] },
  { href: "/admin/director/users", label: "Xodimlar", roles: ["DIRECTOR"] },
  { href: "/admin/director/discounts", label: "Chegirmalar", roles: ["DIRECTOR"] },
  { href: "/admin/director/reviews", label: "Sharhlar", roles: ["DIRECTOR"] },
  { href: "/admin/director/audit", label: "Amallar tarixi", roles: ["DIRECTOR"] },
  { href: "/admin/seller/inquiries", label: "So'rovlar", roles: SELLER_ROLES },
  { href: "/admin/seller/customers", label: "Mijozlar", roles: SELLER_ROLES },
  { href: "/admin/seller/orders", label: "Buyurtmalar", roles: SELLER_ROLES },
];

export function navFor(role: StaffRole): AdminNavItem[] {
  return ADMIN_NAV.filter((item) => item.roles.includes(role));
}

/**
 * The seller's thumb-reachable bar, which is a different surface from the
 * sidebar rather than a narrow copy of it.
 *
 * Four destinations, because a bar has to stay reachable by one thumb and the
 * fifth target is where accuracy starts to go. The first three are sections the
 * sidebar also lists; "Men" is not, because on desktop the sidebar already
 * holds the name, the role and the sign-out button permanently, and a link to a
 * page repeating them would be furniture. On a phone that block is off screen,
 * so those controls need somewhere to live — this is it.
 */
export const SELLER_BOTTOM_NAV_HREFS = [
  "/admin/seller/inquiries",
  "/admin/seller/customers",
  "/admin/seller/orders",
  "/admin/seller/profile",
] as const;

export type SellerBottomHref = (typeof SELLER_BOTTOM_NAV_HREFS)[number];

export interface BottomNavItem {
  href: SellerBottomHref;
  label: string;
}

export const SELLER_BOTTOM_NAV: readonly BottomNavItem[] = [
  { href: "/admin/seller/inquiries", label: "So'rovlar" },
  { href: "/admin/seller/customers", label: "Mijozlar" },
  { href: "/admin/seller/orders", label: "Buyurtmalar" },
  { href: "/admin/seller/profile", label: "Men" },
];

/**
 * Which entry a path belongs to, by longest match.
 *
 * Every director page sits under /admin/director, so a plain prefix test would
 * light up the dashboard entry on the products page too and two sections would
 * claim to be current at once. Shared by both navigations so they can never
 * disagree about where the reader is.
 *
 * Returns undefined for a path under no entry — a customer detail page is under
 * "Mijozlar", but the login screen is under nothing.
 */
export function currentNavHref(
  pathname: string,
  hrefs: readonly string[],
): string | undefined {
  return hrefs
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];
}
