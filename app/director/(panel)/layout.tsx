import { requireDirector } from "@/lib/auth/dal";
import { PanelShell } from "@/components/admin/panel-shell";

/**
 * The gate, for every director page except the login screen beside it.
 *
 * Split out of the root layout (app/director/layout.tsx) so that root can
 * stay neutral and `/director/login` — a sibling of this route group, not a
 * page inside it — never runs this check. See that file's note.
 */
export default async function DirectorPanelLayout({ children }: { children: React.ReactNode }) {
  // proxy.ts already turned away anyone without a DIRECTOR cookie. This is the
  // check that counts: it re-reads the row, so a demoted or deactivated account
  // loses the panel immediately rather than when its token expires.
  const user = await requireDirector();

  return <PanelShell user={user}>{children}</PanelShell>;
}
