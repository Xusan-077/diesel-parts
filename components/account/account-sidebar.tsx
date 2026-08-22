"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Gift,
  Headphones,
  Heart,
  LogOut,
  MapPin,
  Package,
  Star,
  User,
} from "lucide-react";
import {
  ACCOUNT_NAV,
  type AccountNavId,
  type AccountSection,
} from "@/lib/account/nav";
import { profileDisplayName, profileInitials, type Profile } from "@/lib/account/profile";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

const NAV_ICON: Record<AccountNavId, LucideIcon> = {
  details: User,
  orders: Package,
  wishlist: Heart,
  reviews: Star,
  addresses: MapPin,
  notifications: Bell,
  support: Headphones,
  logout: LogOut,
};

type Panel = Dictionary["account"]["profilePanel"];

/** The one row shape, so a link, a section and the sign-out all sit flush. */
const ROW =
  "flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-left type-label transition-colors";

export function AccountIdentity({
  profile,
  phone,
  className,
}: {
  profile: Profile;
  /** Already formatted for display — the sidebar does no phone parsing. */
  phone: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span
        aria-hidden
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-subtle type-label text-accent-strong"
      >
        {profileInitials(profile, phone)}
      </span>
      <div className="min-w-0">
        <p className="truncate type-label text-foreground">
          {profileDisplayName(profile, phone)}
        </p>
        <p className="truncate type-caption text-muted">{phone}</p>
      </div>
    </div>
  );
}

/**
 * The reward balance.
 *
 * There is no bonus ledger yet, so the banner shows a real zero and says so
 * underneath. It is here rather than commented out because the layout has to
 * hold its place — dropping a card of this size in later would move every
 * menu row on the page.
 */
export function AccountBonusBanner({ panel, className }: { panel: Panel; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-sm border border-border bg-surface px-4 py-3",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <Icon icon={Gift} className="text-accent-strong" />
        <span className="type-caption text-muted">{panel.bonusTitle}</span>
      </div>
      <p className="mt-1 type-title text-foreground">{panel.bonusValue}</p>
      <p className="mt-0.5 type-caption text-muted">{panel.bonusHint}</p>
    </div>
  );
}

export function AccountNavList({
  panel,
  active,
  notificationCount,
  onLogout,
  onNavigate,
}: {
  panel: Panel;
  active: AccountSection;
  notificationCount: number;
  onLogout: () => void;
  /** Called after any choice, so the mobile sheet can shut itself. */
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label={panel.menuTitle} className="flex flex-col gap-0.5">
      {ACCOUNT_NAV.map((item) => {
        const label = panel.nav[item.id];

        if (item.kind === "logout") {
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onNavigate?.();
                onLogout();
              }}
              className={cn(ROW, "mt-1 border-t border-border pt-3 text-muted hover:text-foreground")}
            >
              <Icon icon={NAV_ICON[item.id]} size="md" className="shrink-0 text-muted" />
              {label}
            </button>
          );
        }

        /*
         * Sections and the one outbound link are the same control now — both
         * are `<Link>`, because both go somewhere. Only the mark differs: a
         * section can be the page you are on, the link never is.
         */
        const isActive = item.kind === "section" && item.id === active;

        return (
          <Link
            key={item.id}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              ROW,
              isActive
                ? "bg-accent-subtle text-accent-strong"
                : "text-foreground hover:bg-surface-hover"
            )}
          >
            {/* The active row's glyph joins its label rather than staying grey. */}
            <Icon
              icon={NAV_ICON[item.id]}
              size="md"
              className={cn("shrink-0", isActive ? "text-accent-strong" : "text-muted")}
            />
            <span className="flex-1">{label}</span>
            {item.id === "notifications" && notificationCount > 0 ? (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 type-caption font-medium tabular-nums text-accent-foreground">
                {notificationCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

/** Head, balance and menu as one column — the desktop rail. */
export function AccountSidebar(props: {
  panel: Panel;
  profile: Profile;
  phone: string;
  active: AccountSection;
  notificationCount: number;
  onLogout: () => void;
}) {
  const { panel, profile, phone, ...nav } = props;

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <AccountIdentity profile={profile} phone={phone} className="px-1 pb-4" />
      <AccountBonusBanner panel={panel} className="mb-4" />
      <AccountNavList panel={panel} {...nav} />
    </div>
  );
}
