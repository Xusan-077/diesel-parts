import { requireStaff } from "@/lib/auth/dal";
import { PanelShell } from "@/components/admin/panel-shell";

/**
 * The gate: every page under `/panel` shares this one `requireStaff()` check
 * (any signed-in DIRECTOR or SELLER) — a page needing more than that calls
 * `requirePermission()` itself (see e.g. app/panel/(gated)/finance/layout.tsx).
 *
 * A nested segment on purpose, not folded into the root `../layout.tsx`: this
 * is the one call in the tree that can throw for a real reason (an
 * unreachable database via `getStaffUser`'s backend call), and a root
 * layout's own errors have no ancestor segment to catch them. Nesting the
 * gate here means `../error.tsx`/`../not-found.tsx` — one level up, siblings
 * of this route group — are that ancestor.
 */
export default async function PanelGatedLayout({ children }: { children: React.ReactNode }) {
  // proxy.ts already turned away anyone without a session cookie. This is the
  // check that counts: it re-reads the row, so a demoted or deactivated
  // account loses the panel immediately rather than when its token expires.
  const user = await requireStaff();

  return <PanelShell user={user}>{children}</PanelShell>;
}
