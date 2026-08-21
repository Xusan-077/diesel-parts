import { navFor } from "@/lib/auth/admin-nav";
import type { StaffUser } from "@/lib/auth/dal";
import { PanelNav } from "./panel-nav";
import { SignOutButton } from "./sign-out-button";

const ROLE_LABEL: Record<StaffUser["role"], string> = {
  DIRECTOR: "Direktor",
  SELLER: "Sotuvchi",
};

/**
 * Sidebar left, page right — the frame every panel screen renders into.
 *
 * The sign-out button used to be `lg:absolute lg:bottom-6`, which only worked
 * because `lg:sticky` happened to make the aside a containing block, and which
 * would have sat on top of the navigation the moment the nav grew past the
 * viewport. The aside is a flex column now and the button is pushed down by
 * `mt-auto`, so it is at the bottom because it is last, not because it was
 * placed there.
 */
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
        <aside className="flex shrink-0 flex-col border-b border-border px-6 py-6 lg:sticky lg:top-0 lg:h-dvh lg:w-60 lg:border-b-0 lg:border-r">
          <div>
            <p className="type-eyebrow text-muted">Diesel Parts</p>
            <p className="type-label mt-1 text-foreground">{user.name}</p>
            <p className="type-caption text-muted">{ROLE_LABEL[user.role]}</p>
          </div>

          <div className="mt-8 flex-1">
            <PanelNav items={navFor(user.role)} />
          </div>

          <div className="mt-8">
            <SignOutButton />
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-6 py-8 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
