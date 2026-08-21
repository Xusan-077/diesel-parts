"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, MessageCircle, Minus, Plus, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart } from "@/hooks/use-store";
import { useSnapshotStore } from "@/lib/store/stores";
import { MAX_QUANTITY, MIN_QUANTITY } from "@/lib/store/cart";
import { Icon } from "@/components/ui/icon";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import type { Product } from "@/lib/types";

/**
 * How many, and into the cart — without leaving the grid.
 *
 * Buying a filter is rarely buying one filter. The old card had a single
 * add-to-cart icon, so five of something meant five clicks with a toast after
 * each; a stepper beside the button turns that into one decision and one
 * confirmation.
 *
 * The stepper is *local* until the button is pressed. It is a draft quantity,
 * not a live edit of the cart: writing straight through would mean a stray tap
 * on a card in a grid silently changes an order, and there is no undo on a
 * catalog page. Once the part is in the cart the control switches to reading
 * the cart's own quantity, because from then on the stepper *is* the cart —
 * and the cart page is one click away for anything more.
 */
export function ProductCartControl({
  product,
  brandName,
  categoryName,
  lang,
  dict,
  requestPriceLabel,
  className,
}: {
  product: Product;
  /** Localised captions, snapshotted alongside the row. */
  brandName: string;
  categoryName: string;
  lang: Locale;
  dict: Dictionary["productActions"];
  /** Replaces the button's label when the part has no price yet. */
  requestPriceLabel: string;
  className?: string;
}) {
  const cart = useCart();
  const { record } = useSnapshotStore.getState();

  const [draft, setDraft] = useState(MIN_QUANTITY);

  const productId = product.id;
  const inCart = cart.has(productId);
  const inCartQuantity = cart.quantityOf(productId);
  const quantity = inCart ? inCartQuantity : draft;

  function setQuantity(next: number) {
    const clamped = Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, next));
    if (inCart) {
      cart.setQuantity(productId, clamped);
      return;
    }
    setDraft(clamped);
  }

  if (product.price === null) {
    /*
     * No price set yet, so there is nothing to put a quantity against.
     *
     * The link is wrapped rather than being the container itself: the card's
     * body is a column flex, and `flex-1` on a direct child of one means
     * "grow to fill the column", which stretched a 36px button to the full
     * height of the card and left this the only card in the grid a different
     * size. `flex-1` belongs on a child of the row, never on the row.
     */
    return (
      <div className={cn("flex items-center", className)}>
        <Link
          href="/contact"
          className="flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-accent-strong transition-colors hover:border-accent/60"
        >
          <Icon icon={MessageCircle} size="xs" className="hidden @[11rem]:block" />
          <span className="truncate">{requestPriceLabel}</span>
        </Link>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        role="group"
        aria-label={dict.quantity}
        className="flex h-9 shrink-0 items-center rounded-md border border-border"
      >
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            setQuantity(quantity - 1);
          }}
          disabled={quantity <= MIN_QUANTITY}
          aria-label={dict.decrease}
          className="flex h-full w-8 items-center justify-center text-muted transition-colors hover:text-accent-strong disabled:opacity-40 disabled:hover:text-muted"
        >
          <Icon icon={Minus} size="xs" />
        </button>
        {/*
          `aria-live` so the number is announced as it changes — the buttons
          say "increase", which does not say what it became.
        */}
        <span
          aria-live="polite"
          className="w-7 text-center text-sm tabular-nums text-foreground"
        >
          {quantity}
        </span>
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            setQuantity(quantity + 1);
          }}
          disabled={quantity >= MAX_QUANTITY}
          aria-label={dict.increase}
          className="flex h-full w-8 items-center justify-center text-muted transition-colors hover:text-accent-strong disabled:opacity-40 disabled:hover:text-muted"
        >
          <Icon icon={Plus} size="xs" />
        </button>
      </div>

      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          record([{ product, brandName, categoryName }], lang);

          if (inCart) {
            // Already there, and the stepper has been editing it directly —
            // so this is the visitor confirming rather than adding again.
            toast.success(dict.toastCartAdded);
            return;
          }

          cart.add(productId, draft);
          setDraft(MIN_QUANTITY);
          toast.success(dict.toastCartAdded);
        }}
        aria-label={inCart ? `${dict.inCart} (${inCartQuantity})` : dict.addToCart}
        title={inCart ? dict.inCart : dict.addToCart}
        className={cn(
          "flex h-9 min-w-0 shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors @[13rem]:flex-1",
          inCart
            ? "border border-accent bg-accent/10 text-accent-strong"
            : "bg-accent text-accent-foreground hover:bg-accent/90"
        )}
      >
        <Icon icon={inCart ? Check : ShoppingCart} size="xs" />
        <span className="hidden truncate @[13rem]:inline">
          {inCart ? dict.inCart : dict.addToCart}
        </span>
      </button>
    </div>
  );
}
