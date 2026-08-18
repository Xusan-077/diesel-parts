import type { StaffRole } from "./roles";

export interface AdminNavItem {
  href: string;
  label: string;
  /** Roles allowed to see the entry. Mirrors canAccessAdminPath, not a substitute. */
  roles: readonly StaffRole[];
}

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
  { href: "/admin/seller", label: "Sotuvchi paneli", roles: ["SELLER", "DIRECTOR"] },
];

export function navFor(role: StaffRole): AdminNavItem[] {
  return ADMIN_NAV.filter((item) => item.roles.includes(role));
}
