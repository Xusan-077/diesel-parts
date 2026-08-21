"use client";

import Link from "next/link";
import { toast } from "sonner";
import { Check, Heart, MessageCircle, Scale, ShoppingCart, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart, useCompare, useWishlist } from "@/hooks/use-store";
import { useSnapshotStore } from "@/lib/store/stores";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import type { Product } from "@/lib/types";
import { Icon } from "@/components/ui/icon";

const buttonClass =
  "flex h-8 w-8 items-center justify-center rounded-md border transition-colors";

const inactiveClass = "border-border text-muted hover:border-accent/60 hover:text-accent-strong";
const activeClass = "border-accent bg-accent/10 text-accent-strong";

interface IconButtonProps {
  label: string;
  icon: LucideIcon;
  active: boolean;
  disabled?: boolean;
  /** Drawn in the corner when above 1. See the cart button below. */
  count?: number;
  onClick: () => void;
}

function IconButton({ label, icon: glyph, active, disabled, count, onClick }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        "relative",
        buttonClass,
        active ? activeClass : inactiveClass,
        disabled && "cursor-not-allowed opacity-40 hover:border-border hover:text-muted"
      )}
    >
      <Icon icon={glyph} className={cn(active && "fill-current")} />
      {count !== undefined && count > 1 ? (
        <span
          aria-hidden
          className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-accent-foreground"
        >
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </button>
  );
}

interface ProductActionsProps {
  product: Product;
  /** Localised captions, snapshotted alongside the row. */
  brandName: string;
  categoryName: string;
  lang: Locale;
  dict: Dictionary["productActions"];
  className?: string;
}

export function ProductActions({
  product,
  brandName,
  categoryName,
  lang,
  dict,
  className,
}: ProductActionsProps) {
  const wishlist = useWishlist();
  const compare = useCompare();
  const cart = useCart();
  const { record } = useSnapshotStore.getState();

  const productId = product.id;
  // `null` swaps the cart button for a contact link.
  const price = product.price;

  /**
   * Every list holds ids, and every list has a page that has to draw rows.
   * Snapshotting here — at the only point where the whole row is in hand —
   * is what lets those pages paint from localStorage instead of waiting on
   * `/api/products/by-ids` the first time they are opened.
   */
  function remember() {
    record([{ product, brandName, categoryName }], lang);
  }

  const inWishlist = wishlist.has(productId);
  const inCompare = compare.has(productId);
  const inCart = cart.has(productId);
  const cartQuantity = cart.quantityOf(productId);
  const compareBlocked = !inCompare && compare.isFull;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <IconButton
        label={inWishlist ? dict.removeFromWishlist : dict.addToWishlist}
        icon={Heart}
        active={inWishlist}
        onClick={() => {
          remember();
          wishlist.toggle(productId);
          toast.success(
            inWishlist ? dict.toastWishlistRemoved : dict.toastWishlistAdded
          );
        }}
      />
      <IconButton
        label={
          compareBlocked
            ? dict.compareFull
            : inCompare
              ? dict.removeFromCompare
              : dict.addToCompare
        }
        icon={Scale}
        active={inCompare}
        disabled={compareBlocked}
        onClick={() => {
          remember();
          compare.toggle(productId);
          toast.success(inCompare ? dict.toastCompareRemoved : dict.toastCompareAdded);
        }}
      />

      {price === null ? (
        // No price set yet, so there is nothing to put in a cart.
        <Link
          href="/contact"
          aria-label={dict.contact}
          title={dict.contact}
          className={cn(buttonClass, inactiveClass)}
        >
          <Icon icon={MessageCircle} />
        </Link>
      ) : (
        <IconButton
          // The checkmark alone made a second click look like a no-op, so the
          // running quantity is drawn on the button the same way the header
          // badge draws it. The label carries the number for screen readers,
          // which is why the badge itself is aria-hidden.
          label={inCart ? `${dict.inCart} (${cartQuantity})` : dict.addToCart}
          icon={inCart ? Check : ShoppingCart}
          active={inCart}
          count={cartQuantity}
          onClick={() => {
            remember();
            cart.add(productId);
            toast.success(dict.toastCartAdded);
          }}
        />
      )}
    </div>
  );
}
