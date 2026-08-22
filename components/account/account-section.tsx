import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Bell, MapPin, PackageOpen, Star } from "lucide-react";
import type { AccountPlaceholderSection } from "@/lib/account/nav";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { buttonVariants } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

type Panel = Dictionary["account"]["profilePanel"];

/**
 * One section of the cabinet: a titled card with a body.
 *
 * Every section is its own route now, so the card that used to be built inline
 * beside the menu is shared here instead — otherwise the six pages would each
 * have their own idea of what a section header looks like.
 *
 * Server-safe: no state and no `"use client"`, so a section whose body is a
 * server component stays one.
 */
export function AccountPanelCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface">
      <div className="border-b border-border px-6 py-4">
        <h2 className="type-title text-foreground">{title}</h2>
      </div>
      {children}
    </section>
  );
}

/** The sections with nothing behind them yet, and the mark each one shows. */
const EMPTY_ICON: Record<AccountPlaceholderSection, LucideIcon> = {
  orders: PackageOpen,
  reviews: Star,
  addresses: MapPin,
  notifications: Bell,
};

/**
 * A section that has no feature behind it yet.
 *
 * It is a real page rather than a "coming soon" stub because the menu row it
 * answers is real: a visitor who opens Buyurtmalarim is owed a screen that
 * says there are none, not one that says the screen does not exist.
 */
export function AccountEmptySection({
  panel,
  section,
  ordersCta,
}: {
  panel: Panel;
  section: AccountPlaceholderSection;
  ordersCta: string;
}) {
  return (
    <AccountPanelCard title={panel.nav[section]}>
      <div className="flex flex-col items-center px-6 py-14 text-center">
        <Icon icon={EMPTY_ICON[section]} size="xl" className="text-muted" />
        <p className="mt-4 type-body text-muted">{panel.empty[section]}</p>
        {section === "orders" ? (
          <Link href="/products" className={buttonVariants({ className: "mt-6" })}>
            {ordersCta}
          </Link>
        ) : null}
      </div>
    </AccountPanelCard>
  );
}
