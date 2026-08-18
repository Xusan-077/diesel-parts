import { navFor } from "@/lib/auth/admin-nav";
import type { StaffUser } from "@/lib/auth/dal";
import { PanelNav } from "./panel-nav";
import { SignOutButton } from "./sign-out-button";

const ROLE_LABEL: Record<StaffUser["role"], string> = {
  DIRECTOR: "Direktor",
  SELLER: "Sotuvchi",
};

export function PanelShell({
  user,
  children,
}: {
  user: StaffUser;
  children: React.ReactNode;
}) {
  return (
    <div className="admin-root min-h-dvh bg-background">
      <div className="mx-auto flex max-w-[1400px] flex-col lg:flex-row">
        <aside className="shrink-0 border-b border-border px-6 py-6 lg:sticky lg:top-0 lg:h-dvh lg:w-60 lg:border-b-0 lg:border-r lg:px-6">
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-muted">
            Diesel Parts
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">
            {user.name}
          </p>
          <p className="text-xs text-muted">{ROLE_LABEL[user.role]}</p>

          <div className="mt-8">
            <PanelNav items={navFor(user.role)} />
          </div>

          <div className="mt-8 lg:absolute lg:bottom-6">
            <SignOutButton />
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-6 py-8 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
