import { SignOutButton } from "./sign-out-button";
import type { StaffUser } from "@/lib/auth/dal";

const ROLE_LABEL: Record<StaffUser["role"], string> = {
  DIRECTOR: "Direktor",
  SELLER: "Sotuvchi",
};

export function PanelHeader({ user, area }: { user: StaffUser; area: string }) {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <div>
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-muted">
            Diesel Parts <span aria-hidden="true">/</span> {area}
          </p>
          <p className="mt-1 text-sm text-foreground">
            {user.name}{" "}
            <span className="text-muted">— {ROLE_LABEL[user.role]}</span>
          </p>
        </div>
        <SignOutButton />
      </div>
    </header>
  );
}
