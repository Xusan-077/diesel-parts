"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Heart, Scale, ShoppingCart, User } from "lucide-react";
import { AuthDialog } from "@/components/account/auth-dialog";
import { cn } from "@/lib/utils";
import { useAuthHint } from "@/hooks/use-auth-hint";
import { useCart, useCompare, useWishlist } from "@/hooks/use-store";
import { buildHeaderActions, type HeaderActionKey } from "@/lib/nav";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { Icon } from "@/components/ui/icon";

const ICONS: Record<HeaderActionKey, typeof Heart> = {
  compare: Scale,
  favorites: Heart,
  cart: ShoppingCart,
  account: User,
};

interface HeaderActionsProps {
  header: Dictionary["header"];
  account: Dictionary["account"];
  closeLabel: string;
  /** Compact drops the text labels and the compare entry, for narrow screens. */
  compact?: boolean;
  className?: string;
}

export function HeaderActions({
  header,
  account,
  closeLabel,
  compact = false,
  className,
}: HeaderActionsProps) {
  // Counts come from localStorage, so they read as 0 during server render and
  // fill in right after hydration.
  const wishlist = useWishlist();
  const compare = useCompare();
  const cart = useCart();
  const signedIn = useAuthHint();

  const counts: Record<HeaderActionKey, number> = {
    compare: compare.count,
    favorites: wishlist.count,
    cart: cart.unitCount,
    account: 0,
  };

  const actions = buildHeaderActions(header).map((action) => ({
    ...action,
    icon: ICONS[action.key],
    count: counts[action.key],
  }));

  const visible = compact ? actions.filter((action) => action.key !== "compare") : actions;

  const itemClass = cn(
    "flex flex-col items-center gap-1 rounded-md text-muted transition-colors hover:text-accent-strong",
    compact ? "p-2" : "w-16 px-1 py-1.5"
  );

  function body(glyph: typeof Heart, label: string, count: number): ReactNode {
    return (
      <>
        <span className="relative">
          <Icon icon={glyph} size="md" />
          {count > 0 ? (
            <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-accent-foreground">
              {count > 99 ? "99+" : count}
            </span>
          ) : null}
        </span>
        {compact ? null : <span className="text-[11px] leading-none">{label}</span>}
      </>
    );
  }

  return (
    <div className={cn("flex items-center", compact ? "gap-0.5" : "gap-1", className)}>
      {visible.map(({ key, href, label, icon: Icon, count }) =>
        // Signed-out visitors get the login modal instead of the account page.
        key === "account" && !signedIn ? (
          <AuthDialog key={key} dict={account} closeLabel={closeLabel}>
            <button type="button" aria-label={label} title={label} className={itemClass}>
              {body(Icon, label, count)}
            </button>
          </AuthDialog>
        ) : (
          <Link key={key} href={href} aria-label={label} title={label} className={itemClass}>
            {body(Icon, label, count)}
          </Link>
        )
      )}
    </div>
  );
}
