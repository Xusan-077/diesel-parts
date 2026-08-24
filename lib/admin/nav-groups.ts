import type { AdminNavItem } from "@/lib/auth/admin-nav";

/**
 * The panel's sections, gathered into the four jobs a director actually does.
 *
 * The sidebar used to split on the route prefix — everything under
 * `/director` in one pile, everything under `/admin/seller` in another —
 * which is the authorisation boundary, not a working one. It put the products
 * catalogue next to the audit log because both are director-only, and it put
 * orders in a different group from the discounts that gate them.
 *
 * These four are the jobs: look at the numbers, keep the catalogue, work the
 * sales floor, run the company. The route guard is unaffected — it still reads
 * `ADMIN_NAV.roles`, and an entry a user may not see never reaches this file.
 *
 * Only routes that exist appear. An entry pointing at a page nobody has built
 * reads as a broken panel, not as a roadmap, so the groups the brief sketched
 * for warehouse movements, returns and debts are absent until those pages are.
 */
export type NavGroupId = "overview" | "catalog" | "sales" | "management";

/** Group order, and the routes each one claims. */
const GROUPS: readonly { id: NavGroupId; hrefs: readonly string[] }[] = [
  { id: "overview", hrefs: ["/director", "/director/analytics", "/admin/seller"] },
  {
    id: "catalog",
    hrefs: ["/director/products", "/director/categories", "/director/discounts"],
  },
  {
    id: "sales",
    hrefs: ["/admin/seller/inquiries", "/admin/seller/orders", "/admin/seller/customers"],
  },
  {
    id: "management",
    hrefs: ["/director/users", "/director/reviews", "/director/audit"],
  },
];

export interface NavGroup {
  id: NavGroupId;
  items: AdminNavItem[];
}

/**
 * Groups the entries this user is allowed to see, in `GROUPS` order.
 *
 * An entry that belongs to no group is appended to `management` rather than
 * dropped: a new route added to `ADMIN_NAV` and forgotten here should still be
 * reachable, and a link in the wrong group is a smaller failure than a section
 * that silently disappears from the sidebar.
 */
export function groupNav(items: readonly AdminNavItem[]): NavGroup[] {
  const byHref = new Map(items.map((item) => [item.href, item]));
  const claimed = new Set(GROUPS.flatMap((group) => group.hrefs));

  const groups = GROUPS.map((group) => ({
    id: group.id,
    items: group.hrefs
      .map((href) => byHref.get(href))
      .filter((item): item is AdminNavItem => item !== undefined),
  }));

  const orphans = items.filter((item) => !claimed.has(item.href));
  if (orphans.length > 0) {
    const management = groups.find((group) => group.id === "management");
    management?.items.push(...orphans);
  }

  return groups.filter((group) => group.items.length > 0);
}
