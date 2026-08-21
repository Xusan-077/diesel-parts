import { requireStaff } from "@/lib/auth/dal";
import { PanelShell } from "@/components/admin/panel-shell";

export default async function SellerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  return <PanelShell user={user}>{children}</PanelShell>;
}
