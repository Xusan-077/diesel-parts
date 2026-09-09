import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

/**
 * Mobile-only: the running total and the checkout button pinned to the bottom
 * of the viewport, so they stay reachable however far the shopper has scrolled
 * down a long cart. Hidden at `lg` and up, where the sticky summary card in the
 * right column already keeps both in view — the same split CheckoutSummarySheet
 * makes on the checkout screen.
 */
export function CartStickyBar({
  priceLabel,
  totalLabel,
  checkoutLabel,
}: {
  priceLabel: string;
  /** Already formatted — the full sum, or the "price on request" wording. */
  totalLabel: string;
  checkoutLabel: string;
}) {
  return (
    <div className="lg:hidden">
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface-elevated p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <span className="text-xs text-muted">{priceLabel}</span>
          <span className="type-title tabular-nums text-foreground">{totalLabel}</span>
        </div>
        <Link href="/checkout" className={buttonVariants({ size: "lg", className: "w-full" })}>
          {checkoutLabel}
        </Link>
      </div>

      {/* Spacer so the fixed bar never sits over the last cart row. */}
      <div aria-hidden className="h-32" />
    </div>
  );
}
