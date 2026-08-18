import { requireDirector } from "@/lib/auth/dal";
import { PanelShell } from "@/components/admin/panel-shell";

export default async function DirectorLayout({ children }: { children: React.ReactNode }) {
  // proxy.ts already turned away anyone without a DIRECTOR cookie. This is the
  // check that counts: it re-reads the row, so a demoted or deactivated account
  // loses the section immediately rather than when its token expires.
  const user = await requireDirector();

  return <PanelShell user={user}>{children}</PanelShell>;
}
