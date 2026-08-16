"use client";

import Link from "next/link";
import { Check, Heart, MessageCircle, Scale, ShoppingCart, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart, useCompare, useWishlist } from "@/hooks/use-store";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
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
  onClick: () => void;
}

function IconButton({ label, icon: glyph, active, disabled, onClick }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        buttonClass,
        active ? activeClass : inactiveClass,
        disabled && "cursor-not-allowed opacity-40 hover:border-border hover:text-muted"
      )}
    >
      <Icon icon={glyph} className={cn(active && "fill-current")} />
    </button>
  );
}

interface ProductActionsProps {
  productId: string;
  /** `null` swaps the cart button for a contact link. */
  price: number | null;
  lang: Locale;
  dict: Dictionary["productActions"];
  className?: string;
}

export function ProductActions({
  productId,
  price,
  lang,
  dict,
  className,
}: ProductActionsProps) {
  const wishlist = useWishlist();
  const compare = useCompare();
  const cart = useCart();

  const inWishlist = wishlist.has(productId);
  const inCompare = compare.has(productId);
  const inCart = cart.has(productId);
  const compareBlocked = !inCompare && compare.isFull;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <IconButton
        label={inWishlist ? dict.removeFromWishlist : dict.addToWishlist}
        icon={Heart}
        active={inWishlist}
        onClick={() => wishlist.toggle(productId)}
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
        onClick={() => compare.toggle(productId)}
      />

      {price === null ? (
        // No price set yet, so there is nothing to put in a cart.
        <Link
          href={`/${lang}/contact`}
          aria-label={dict.contact}
          title={dict.contact}
          className={cn(buttonClass, inactiveClass)}
        >
          <Icon icon={MessageCircle} />
        </Link>
      ) : (
        <IconButton
          label={inCart ? dict.inCart : dict.addToCart}
          icon={inCart ? Check : ShoppingCart}
          active={inCart}
          onClick={() => cart.add(productId)}
        />
      )}
    </div>
  );
}
