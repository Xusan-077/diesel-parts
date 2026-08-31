"use client";

import Link from "next/link";
import { toast } from "sonner";
import { motion } from "motion/react";
import { MessageCircle, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart } from "@/hooks/use-store";
import { useSnapshotStore } from "@/lib/store/stores";
import { MOTION } from "@/components/providers/motion-provider";
import { MAX_QUANTITY, MIN_QUANTITY } from "@/lib/store/cart";
import { Icon } from "@/components/ui/icon";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import type { Product } from "@/lib/types";

/**
 * One slot at the foot of the card, holding whichever control the part is
 * currently owed.
 *
 * A part that is not in the cart owes exactly one decision — put it in — so the
 * card shows one button and nothing else. A part that *is* in the cart owes a
 * different one — how many — so the same slot becomes the stepper, reading and
 * writing the cart's own quantity. There is no draft quantity any more: a
 * stepper standing beside an add button asked the visitor to choose an amount
 * for something they had not yet decided to buy, and left two controls on every
 * tile of a grid that mostly wants one.
 *
 * The slot is a fixed `h-9` box and both states fill it, so the swap happens
 * without a pixel of movement — the card below the button must not jump under
 * a finger that is still on the screen.
 *
 * Stepping below one is how a part leaves the cart: `setCartQuantity` drops the
 * line at zero, the quantity read here goes back to zero, and the slot returns
 * to the add button. That is why the minus turns into a bin at one — the
 * control says what the next press will actually do.
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

  const productId = product.id;
  const quantity = cart.quantityOf(productId);
  const inCart = quantity > 0;

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
      <div className={cn(className)}>
        <div className="flex h-9 items-center">
          <Link
            href="/contact"
            className="flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-accent-strong transition-colors hover:border-accent/60"
          >
            <Icon icon={MessageCircle} size="xs" className="hidden @[11rem]:block" />
            <span className="truncate">{requestPriceLabel}</span>
          </Link>
        </div>
      </div>
    );
  }

  const atLast = quantity <= MIN_QUANTITY;

  return (
    <div className={cn(className)}>
      {/* The fixed box the two states share. */}
      <div className="h-9">
        {inCart ? (
          <motion.div
            key="stepper"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={MOTION.pop}
            role="group"
            aria-label={dict.quantity}
            className="flex h-9 w-full items-center rounded-md border border-accent bg-accent/10"
          >
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                cart.setQuantity(productId, quantity - 1);
                if (atLast) {
                  toast.success(dict.toastCartRemoved);
                }
              }}
              aria-label={atLast ? dict.removeFromCart : dict.decrease}
              title={atLast ? dict.removeFromCart : dict.decrease}
              className="flex h-full w-9 shrink-0 items-center justify-center rounded-l-md text-accent-strong transition-colors hover:bg-accent/15"
            >
              <Icon icon={atLast ? Trash2 : Minus} size="xs" />
            </button>

            {/*
              `aria-live` so the number is announced as it changes — the buttons
              say "increase", which does not say what it became.
            */}
            <span
              aria-live="polite"
              className="min-w-0 flex-1 text-center text-sm font-semibold tabular-nums text-accent-strong"
            >
              {quantity}
            </span>

            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                cart.setQuantity(productId, quantity + 1);
              }}
              disabled={quantity >= MAX_QUANTITY}
              aria-label={dict.increase}
              title={dict.increase}
              className="flex h-full w-9 shrink-0 items-center justify-center rounded-r-md text-accent-strong transition-colors hover:bg-accent/15 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <Icon icon={Plus} size="xs" />
            </button>
          </motion.div>
        ) : (
          <motion.button
            key="add"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={MOTION.pop}
            type="button"
            onClick={(event) => {
              event.preventDefault();
              record([{ product, brandName, categoryName }], lang);
              cart.add(productId, MIN_QUANTITY);
              toast.success(dict.toastCartAdded);
            }}
            aria-label={dict.addToCart}
            title={dict.addToCart}
            className="flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover active:bg-accent-active"
          >
            <Icon icon={ShoppingCart} size="xs" className="hidden @[9rem]:block" />
            <span className="truncate">{dict.addToCart}</span>
          </motion.button>
        )}
      </div>
    </div>
  );
}
