"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import { Menu } from "lucide-react";
import {
  AccountBonusBanner,
  AccountIdentity,
  AccountNavList,
  AccountSidebar,
} from "./account-sidebar";
import { accountSectionFromPath } from "@/lib/account/nav";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { useProfile } from "@/hooks/use-store";
import { Button } from "@/components/ui/button";
import { FormModalShell } from "@/components/ui/form-modal-shell";
import { Icon } from "@/components/ui/icon";

/**
 * There is no notification feed yet. The count is threaded through as a real
 * number so the badge appears the day one exists, rather than being invented
 * in the markup.
 */
const NOTIFICATION_COUNT = 0;

/**
 * The cabinet's frame: a menu rail, and the section it points at.
 *
 * The section is `children` now, not state. Each one is a route under
 * /account (see lib/account/nav.ts), so this component renders once per
 * navigation and the panel beside it is whatever the router matched — which
 * is what lets "Saralanganlar" be a page at /account/wishlist with the real
 * list on it rather than a link out of the cabinet.
 *
 * Still a client component, and for the two reasons it always was: the head
 * shows the profile, which lives in the browser (lib/account/profile.ts), and
 * the sign-out is an action. The one thing that comes from the server — the
 * signed-in number — is passed in already formatted, so this tree never parses
 * a phone.
 */
export function AccountCabinet({
  dict,
  phone,
  children,
}: {
  dict: Dictionary["account"];
  /** Display form of the session's number, e.g. "+998 90 123-45-67". */
  phone: string;
  children: React.ReactNode;
}) {
  const panel = dict.profilePanel;
  const router = useRouter();
  const pathname = usePathname();
  const { profile } = useProfile();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    try {
      await axios.post("/api/auth/logout");
    } catch {
      // The cookie either cleared or it did not; either way this visitor is
      // leaving the screen. Same reasoning as components/account/logout-button.
    }
    toast.success(dict.toastSignedOut);
    router.push("/");
    router.refresh();
  }

  const navProps = {
    panel,
    // Read off the URL rather than held here: the browser's back button and a
    // pasted link have to move the mark too, and they never call a setter.
    active: accountSectionFromPath(pathname),
    notificationCount: NOTIFICATION_COUNT,
    onLogout: handleLogout,
  };

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-8">
      {/* Desktop: the rail, held in view while the panel scrolls. */}
      <aside className="hidden lg:sticky lg:top-24 lg:block">
        <AccountSidebar profile={profile} phone={phone} {...navProps} />
      </aside>

      {/* Mobile: the same head, with the menu itself moved into a bottom sheet
          so the panel keeps the full width. */}
      <div className="rounded-lg border border-border bg-surface p-4 lg:hidden">
        <AccountIdentity profile={profile} phone={phone} className="px-1 pb-4" />
        <AccountBonusBanner panel={panel} />
        <Button
          type="button"
          variant="outline"
          className="mt-4 w-full"
          onClick={() => setMenuOpen(true)}
        >
          <Icon icon={Menu} />
          {panel.menuLabel}
        </Button>
      </div>

      <main>{children}</main>

      <FormModalShell
        open={menuOpen}
        onOpenChange={setMenuOpen}
        variant="sheet"
        title={panel.menuTitle}
        closeLabel={panel.close}
      >
        <AccountNavList {...navProps} onNavigate={() => setMenuOpen(false)} />
      </FormModalShell>
    </div>
  );
}
