"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Heart, Scale, ShoppingCart, User } from "lucide-react";
import { AuthDialog } from "@/components/account/auth-dialog";
import { cn } from "@/lib/utils";
import { useAuthHint } from "@/hooks/use-auth-hint";
import { useCart, useCompare, useWishlist } from "@/hooks/use-store";
import { formatPhone } from "@/lib/auth/phone";
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
  /**
   * The signed-in visitor's number, read from the session on the server.
   *
   * The session cookie is httpOnly, so this is the only way the number can
   * reach the header at all — and having it before the first paint is what
   * keeps the account entry from rendering as an icon and then swapping to a
   * number a frame later.
   */
  phone?: string | null;
  /** Compact drops the text labels and the compare entry, for narrow screens. */
  compact?: boolean;
  className?: string;
}

export function HeaderActions({
  header,
  account,
  closeLabel,
  phone = null,
  compact = false,
  className,
}: HeaderActionsProps) {
  // Counts come from localStorage, so they read as 0 during server render and
  // fill in right after hydration.
  const wishlist = useWishlist();
  const compare = useCompare();
  const cart = useCart();
  /*
   * A number proves a session; the hint cookie only suggests one. Both are
   * consulted, and in that order: the server's answer arrives in the HTML and
   * is authoritative, while the hint still covers the case it always covered —
   * a cookie left over from a session the server no longer honours, which gets
   * the account page rather than a login dialog that would say nothing useful.
   */
  const authHint = useAuthHint();
  const signedIn = phone !== null || authHint;

  /*
   * All three badges count the same kind of thing: how many parts the visitor
   * has put somewhere. The cart used to answer in units instead, so ordering
   * seven of one screwdriver read as "7" beside a favourites "1" — three
   * numbers in a row, two of them meaning something else.
   *
   * Units are still worth showing, just not here, where there is no room to
   * say which is which. The cart page prints both against their own labels.
   */
  const counts: Record<HeaderActionKey, number> = {
    compare: compare.count,
    favorites: wishlist.count,
    cart: cart.lineCount,
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

  /*
   * Signed in, on a screen with room for it, the account entry stops being a
   * fourth icon and becomes the number itself.
   *
   * It is set as a bordered field rather than an icon column on purpose: the
   * three entries beside it are things the visitor collected, and this one is
   * who they are. Tabular figures, because it is a number that has to be
   * recognised at a glance, not read. A phone keeps the icon — the number is
   * 130px the narrow header does not have, and the compare entry has already
   * been dropped at that width for the same reason.
   */
  function accountEntry(label: string, count: number): ReactNode {
    if (!signedIn) {
      // Signed-out visitors get the login modal instead of the account page.
      return (
        <AuthDialog key="account" dict={account} closeLabel={closeLabel}>
          <button type="button" aria-label={label} title={label} className={itemClass}>
            {body(ICONS.account, label, count)}
          </button>
        </AuthDialog>
      );
    }

    if (compact || phone === null) {
      return (
        <Link
          key="account"
          href="/account"
          aria-label={label}
          title={label}
          className={itemClass}
        >
          {body(ICONS.account, label, count)}
        </Link>
      );
    }

    const readable = formatPhone(phone);
    const signedInLabel = header.accountSignedIn.replace("{phone}", readable);

    return (
      <Link
        key="account"
        href="/account"
        aria-label={signedInLabel}
        title={signedInLabel}
        className="ml-1 flex h-10 items-center rounded-md border border-border px-3 text-[13px] font-medium tabular-nums leading-none text-foreground transition-colors hover:border-accent/60 hover:text-accent-strong"
      >
        {readable}
      </Link>
    );
  }

  return (
    <div className={cn("flex items-center", compact ? "gap-0.5" : "gap-1", className)}>
      {visible.map(({ key, href, label, icon: Icon, count }) =>
        key === "account" ? (
          accountEntry(label, count)
        ) : (
          <Link key={key} href={href} aria-label={label} title={label} className={itemClass}>
            {body(Icon, label, count)}
          </Link>
        )
      )}
    </div>
  );
}
