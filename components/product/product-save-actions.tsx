"use client";

import { toast } from "sonner";
import { Heart, Scale } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCompare, useWishlist } from "@/hooks/use-store";
import { useSnapshotStore } from "@/lib/store/stores";
import { Icon } from "@/components/ui/icon";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import type { Product } from "@/lib/types";

/**
 * Save and compare, mounted in the corner of a card's picture.
 *
 * These two are the "not now" actions — keep this for later, hold it against
 * something else — and they belong on the picture rather than in the row with
 * the cart button, which is the "yes" action. Separating them by position is
 * what lets the cart control below take the width it needs.
 *
 * They are drawn on the picture as filled discs, because a bare outline icon on
 * a photograph is legible against exactly one background.
 */
export function ProductSaveActions({
  product,
  brandName,
  categoryName,
  lang,
  dict,
  className,
}: {
  product: Product;
  /** Localised captions, snapshotted alongside the row. */
  brandName: string;
  categoryName: string;
  lang: Locale;
  dict: Dictionary["productActions"];
  className?: string;
}) {
  const wishlist = useWishlist();
  const compare = useCompare();
  const { record } = useSnapshotStore.getState();

  const productId = product.id;
  const inWishlist = wishlist.has(productId);
  const inCompare = compare.has(productId);
  const compareBlocked = !inCompare && compare.isFull;

  /**
   * Every list holds ids, and every list has a page that has to draw rows.
   * Snapshotting here — at the only point where the whole row is in hand — is
   * what lets those pages paint from localStorage instead of waiting on
   * `/api/products/by-ids` the first time they are opened.
   */
  function remember() {
    record([{ product, brandName, categoryName }], lang);
  }

  const buttons = [
    {
      key: "wishlist",
      icon: Heart,
      label: inWishlist ? dict.removeFromWishlist : dict.addToWishlist,
      active: inWishlist,
      disabled: false,
      onClick: () => {
        remember();
        wishlist.toggle(productId);
        toast.success(inWishlist ? dict.toastWishlistRemoved : dict.toastWishlistAdded);
      },
    },
    {
      key: "compare",
      icon: Scale,
      label: compareBlocked
        ? dict.compareFull
        : inCompare
          ? dict.removeFromCompare
          : dict.addToCompare,
      active: inCompare,
      disabled: compareBlocked,
      onClick: () => {
        remember();
        compare.toggle(productId);
        toast.success(inCompare ? dict.toastCompareRemoved : dict.toastCompareAdded);
      },
    },
  ];

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {buttons.map(({ key, icon, label, active, disabled, onClick }) => (
        <button
          key={key}
          type="button"
          onClick={(event) => {
            // The card's title link is stretched over everything below this.
            event.preventDefault();
            onClick();
          }}
          disabled={disabled}
          aria-label={label}
          aria-pressed={active}
          title={label}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur-sm transition-colors",
            active
              ? "border-accent bg-accent/15 text-accent-strong"
              : "border-border bg-surface/90 text-muted hover:text-accent-strong",
            disabled && "cursor-not-allowed opacity-40 hover:text-muted"
          )}
        >
          <Icon icon={icon} className={cn(active && "fill-current")} />
        </button>
      ))}
    </div>
  );
}
