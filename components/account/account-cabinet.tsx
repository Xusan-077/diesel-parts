"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";
import { Bell, MapPin, Menu, PackageOpen, Star } from "lucide-react";
import {
  AccountBonusBanner,
  AccountIdentity,
  AccountNavList,
  AccountSidebar,
} from "./account-sidebar";
import { ProfilePanel } from "./profile-panel";
import { DEFAULT_ACCOUNT_SECTION, type AccountSection } from "@/lib/account/nav";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { useProfile } from "@/hooks/use-store";
import { Button, buttonVariants } from "@/components/ui/button";
import { FormModalShell } from "@/components/ui/form-modal-shell";
import { Icon } from "@/components/ui/icon";

type Panel = Dictionary["account"]["profilePanel"];

/** The sections with nothing behind them yet, and the mark each one shows. */
const EMPTY_ICON: Record<Exclude<AccountSection, "details">, LucideIcon> = {
  orders: PackageOpen,
  reviews: Star,
  addresses: MapPin,
  notifications: Bell,
};

/**
 * There is no notification feed yet. The count is threaded through as a real
 * number so the badge appears the day one exists, rather than being invented
 * in the markup.
 */
const NOTIFICATION_COUNT = 0;

function EmptySection({
  panel,
  section,
  ordersCta,
}: {
  panel: Panel;
  section: Exclude<AccountSection, "details">;
  ordersCta: string;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface">
      <div className="border-b border-border px-6 py-4">
        <h2 className="type-title text-foreground">{panel.nav[section]}</h2>
      </div>
      <div className="flex flex-col items-center px-6 py-14 text-center">
        <Icon icon={EMPTY_ICON[section]} size="xl" className="text-muted" />
        <p className="mt-4 type-body text-muted">{panel.empty[section]}</p>
        {section === "orders" ? (
          <Link href="/products" className={buttonVariants({ className: "mt-6" })}>
            {ordersCta}
          </Link>
        ) : null}
      </div>
    </section>
  );
}

/**
 * The account screen: a menu rail and the panel it selects.
 *
 * Client-side because the profile it shows lives in the browser (see
 * lib/account/profile.ts) and because every card here opens a modal. The one
 * thing that does come from the server — the signed-in number — is passed in
 * already formatted, so this tree never parses a phone.
 */
export function AccountCabinet({
  dict,
  phone,
}: {
  dict: Dictionary["account"];
  /** Display form of the session's number, e.g. "+998 90 123-45-67". */
  phone: string;
}) {
  const panel = dict.profilePanel;
  const router = useRouter();
  const { profile, save } = useProfile();
  const [section, setSection] = useState<AccountSection>(DEFAULT_ACCOUNT_SECTION);
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
    active: section,
    notificationCount: NOTIFICATION_COUNT,
    onSelect: setSection,
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

      <main>
        {section === "details" ? (
          <ProfilePanel dict={dict} profile={profile} phone={phone} onSave={save} />
        ) : (
          <EmptySection panel={panel} section={section} ordersCta={dict.ordersEmptyCta} />
        )}
      </main>

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
