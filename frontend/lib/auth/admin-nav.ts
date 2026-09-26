import type { StaffRole } from "./roles";
import { can, type Permission } from "./permissions";

export interface AdminNavItem {
  href: string;
  label: string;
  /** The permission a role needs to see this entry — mirrors what the page itself requires via requirePermission(), not a substitute for it. */
  permission: Permission;
}

/**
 * The panel's navigation, in reading order.
 *
 * Only routes that exist appear here: an entry pointing at a page that has not
 * been built yet reads as a broken panel, not as a roadmap.
 */
export const ADMIN_NAV: readonly AdminNavItem[] = [
  { href: "/panel", label: "Ko'rsatkichlar", permission: "analytics:read" },
  { href: "/panel/analytics", label: "Analitika", permission: "analytics:read" },
  { href: "/panel/finance", label: "Moliya", permission: "finance:read" },
  { href: "/panel/products", label: "Mahsulotlar", permission: "products:read" },
  { href: "/panel/warehouse", label: "Ombor", permission: "warehouse:read" },
  { href: "/panel/customers", label: "Mijozlar", permission: "customers:read" },
  { href: "/panel/categories", label: "Kategoriyalar", permission: "categories:read" },
  { href: "/panel/users", label: "Xodimlar", permission: "users:read" },
  { href: "/panel/discounts", label: "Chegirmalar", permission: "discounts:approve" },
  { href: "/panel/reviews", label: "Sharhlar", permission: "reviews:read" },
  { href: "/panel/audit", label: "Amallar tarixi", permission: "audit:read" },
  { href: "/panel/seller/inquiries", label: "So'rovlar", permission: "inquiries:read" },
  { href: "/panel/seller/customers", label: "Mijozlar", permission: "customers:read" },
  { href: "/panel/seller/orders", label: "Buyurtmalar", permission: "orders:read" },
];

export function navFor(role: StaffRole): AdminNavItem[] {
  return ADMIN_NAV.filter((item) => can(role, item.permission));
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
  "/panel/seller/inquiries",
  "/panel/seller/customers",
  "/panel/seller/orders",
  "/panel/seller/profile",
] as const;

export type SellerBottomHref = (typeof SELLER_BOTTOM_NAV_HREFS)[number];

export interface BottomNavItem {
  href: SellerBottomHref;
  label: string;
}

export const SELLER_BOTTOM_NAV: readonly BottomNavItem[] = [
  { href: "/panel/seller/inquiries", label: "So'rovlar" },
  { href: "/panel/seller/customers", label: "Mijozlar" },
  { href: "/panel/seller/orders", label: "Buyurtmalar" },
  { href: "/panel/seller/profile", label: "Men" },
];

/**
 * Which entry a path belongs to, by longest match.
 *
 * Every panel page sits under /panel, so a plain prefix test would light up
 * the dashboard entry on the products page too and two sections would claim
 * to be current at once. Shared by both navigations so they can never
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
