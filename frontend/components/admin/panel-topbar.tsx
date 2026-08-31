"use client";

import Link from "next/link";
import { Bell, Menu, MessageSquare } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import type { Locale } from "@/lib/i18n/locales";
import type { PanelDictionary } from "@/lib/i18n/panel-dictionary";
import { PanelProfileMenu } from "./panel-profile-menu";
import { PanelSearch } from "./panel-search";
import type { NavGroupView, NavLink } from "./panel-nav";

/**
 * A queue the reader can act on, with its depth.
 *
 * The two chrome glyphs are links, not bells. A notification centre would be a
 * second inbox to keep in step with the pages that already hold these rows;
 * what a director wants from the corner of the screen is "how many, and take
 * me there", and a link with a count is the whole of it.
 */
export interface PanelAlert {
  href: string;
  label: string;
  count: number;
  kind: "approvals" | "inquiries";
}

const ALERT_GLYPH: Record<PanelAlert["kind"], LucideIcon> = {
  approvals: Bell,
  inquiries: MessageSquare,
};

function AlertLink({ alert, noneLabel }: { alert: PanelAlert; noneLabel: string }) {
  const glyph = ALERT_GLYPH[alert.kind];

  return (
    <Link
      href={alert.href}
      /* The count is in the accessible name, not only in the badge: a badge is
         a visual shorthand and "Yangi so'rovlar" alone would tell a screen
         reader nothing about whether it is worth opening. */
      aria-label={alert.label + ": " + (alert.count > 0 ? alert.count : noneLabel)}
      title={alert.label}
      className="relative grid h-10 w-10 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
    >
      <Icon icon={glyph} size="md" />
      {alert.count > 0 ? (
        <span aria-hidden="true" className="chrome-badge">
          {alert.count > 9 ? "9+" : alert.count}
        </span>
      ) : null}
    </Link>
  );
}

/**
 * The panel's top edge.
 *
 * The panel had no top zone at all: a page opened with its own `<h1>` and the
 * search, the queues and the reader's identity had nowhere to live, so
 * identity ended up in the sidebar and the rest ended up nowhere. This is the
 * one place in the panel that is the same on every screen, which is exactly
 * why the things that are not about the current screen belong in it.
 *
 * Sticky and translucent. The page scrolls under it, and the blur is what
 * keeps a table header from reading as part of the bar when it passes behind.
 */
export function PanelTopbar({
  groups,
  alerts,
  quickLinks,
  name,
  email,
  roleLabel,
  dict,
  locale,
  onOpenDrawer,
}: {
  groups: NavGroupView[];
  alerts: PanelAlert[];
  quickLinks: NavLink[];
  name: string;
  email: string;
  roleLabel: string;
  dict: PanelDictionary;
  locale: Locale;
  onOpenDrawer: () => void;
}) {
  return (
    <header className="panel-chrome sticky top-0 z-30 border-b border-border">
      <div className="flex h-16 items-center gap-3 px-4 lg:px-8">
        <button
          type="button"
          onClick={onOpenDrawer}
          aria-label={dict.topbar.openMenu}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-border text-foreground transition-colors hover:bg-surface-hover lg:hidden"
        >
          <Icon icon={Menu} size="md" />
        </button>

        <PanelSearch
          groups={groups}
          placeholder={dict.topbar.searchPlaceholder}
          title={dict.topbar.searchTitle}
          emptyLabel={dict.topbar.searchEmpty}
          hint={dict.topbar.searchHint}
        />

        <div className="ms-auto flex items-center gap-1">
          {alerts.map((alert) => (
            <AlertLink key={alert.href} alert={alert} noneLabel={dict.topbar.none} />
          ))}

          <span aria-hidden="true" className="mx-2 h-6 w-px bg-border" />

          <PanelProfileMenu
            name={name}
            email={email}
            roleLabel={roleLabel}
            quickLinks={quickLinks}
            dict={dict}
            locale={locale}
          />
        </div>
      </div>
    </header>
  );
}
