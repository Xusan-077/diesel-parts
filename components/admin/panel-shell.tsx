import { navFor } from "@/lib/auth/admin-nav";
import type { StaffUser } from "@/lib/auth/dal";
import { groupNav } from "@/lib/admin/nav-groups";
import { getDashboardCounts } from "@/lib/api/analytics-repository";
import { navLabel } from "@/lib/i18n/panel-dictionary";
import { getPanelLocale } from "@/lib/i18n/panel-locale";
import { LanguageSync } from "@/components/providers/language-sync";
import { PanelFrame } from "./panel-frame";
import type { NavGroupView, NavLink } from "./panel-nav";
import type { PanelAlert } from "./panel-topbar";

/**
 * The frame every panel screen renders into.
 *
 * A Server Component, and the whole point of the split is that it stays one:
 * it reads the signed-in user, the language cookie and the queue depths, and
 * hands `PanelFrame` plain strings and numbers. The page's own tree is passed
 * through as `children` and never crosses the client boundary, so a dashboard
 * that queries the database is still rendered on the server even though the
 * chrome around it is interactive.
 *
 * Translating the navigation here rather than in the client is the same call.
 * A label is a string; shipping three dictionaries to the browser so the
 * sidebar could pick one would cost more than the eleven words it saves.
 */
export async function PanelShell({
  user,
  children,
}: {
  user: StaffUser;
  children: React.ReactNode;
}) {
  const { locale, dict } = await getPanelLocale();

  const items = navFor(user.role);
  const groups: NavGroupView[] = groupNav(items).map((group) => ({
    id: group.id,
    label: dict.nav.groups[group.id],
    items: group.items.map((item) => ({
      href: item.href,
      label: navLabel(dict, item.href, item.label),
    })),
  }));

  const counts = await getDashboardCounts();

  /*
   * A queue only appears in the chrome if the reader may open the page behind
   * it. A seller has no route to the discount queue, and a badge that takes
   * them to a redirect is worse than no badge.
   */
  const reachable = new Set(items.map((item) => item.href));
  const alerts: PanelAlert[] = (
    [
      {
        href: "/director/discounts",
        label: dict.topbar.approvals,
        count: counts.pendingDiscounts,
        kind: "approvals",
      },
      {
        href: "/admin/seller/inquiries",
        label: dict.topbar.inquiries,
        count: counts.newInquiries,
        kind: "inquiries",
      },
    ] satisfies PanelAlert[]
  ).filter((alert) => reachable.has(alert.href));

  /*
   * The profile menu's jump list: the first entry of each group, which is the
   * screen a director actually opens that section for. Deriving it beats a
   * hand-kept list that would go stale the first time a route is renamed.
   */
  const quickLinks: NavLink[] = groups
    .map((group) => group.items[0])
    .filter((item): item is NavLink => item !== undefined);

  return (
    <PanelFrame
      brand={dict.brand}
      name={user.name}
      email={user.email}
      roleLabel={dict.role[user.role]}
      groups={groups}
      alerts={alerts}
      quickLinks={quickLinks}
      dict={dict}
      locale={locale}
    >
      {/* The panel reads the language cookie; the store is the copy the
          switcher writes. `LanguageSync` repairs the two when a cleared cookie
          leaves them disagreeing, exactly as it does on the marketing site. */}
      <LanguageSync serverLanguage={locale} />
      {children}
    </PanelFrame>
  );
}
