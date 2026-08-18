"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { QuoteForm } from "@/components/forms/quote-form";
import { useCart } from "@/hooks/use-store";
import {
  formatCartForQuote,
  toQuoteCartItems,
  totalQuantity,
  type CartLine,
} from "@/lib/cart-summary";
import { formatPrice, sumPrices } from "@/lib/format-price";
import { useResolvedProducts } from "@/hooks/use-resolved-products";
import { ResolvedProductsSkeleton } from "@/components/store/resolved-products-skeleton";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { Icon } from "@/components/ui/icon";

interface QuoteFormWithCartProps {
  lang: Locale;
  dict: Dictionary["requestQuote"];
  cartDict: Dictionary["cart"];
}

/**
 * Reads the cart and hands it to the quote form. Until there is an order
 * backend, this is how a cart turns into something a manager can act on.
 */
export function QuoteFormWithCart({ lang, dict, cartDict }: QuoteFormWithCartProps) {
  const cart = useCart();

  const { items: resolved, isLoading } = useResolvedProducts(
    cart.items.map((item) => item.productId),
    lang,
  );
  const byId = new Map(resolved.map((entry) => [entry.product.id, entry]));

  const lines: CartLine[] = cart.items
    .map((item) => {
      const entry = byId.get(item.productId);
      return entry ? { product: entry.product, quantity: item.quantity } : null;
    })
    .filter((line): line is CartLine => line !== null);

  const summaryText = formatCartForQuote(lines, lang, {
    onRequest: cartDict.priceOnRequest,
    total: cartDict.summaryPrice,
  });

  const { total, unpriced } = sumPrices(
    lines.map((line) => ({ price: line.product.price, quantity: line.quantity }))
  );

  return (
    <div className="space-y-8">
      {isLoading ? <ResolvedProductsSkeleton count={cart.items.length} /> : null}

      {!isLoading && lines.length > 0 ? (
        <section className="rounded-lg border border-accent/40 bg-accent/5 p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Icon icon={ShoppingCart} className="text-accent-strong" />
            {dict.fromCartTitle}
          </h2>
          <p className="mt-1 text-xs text-muted">{dict.fromCartNote}</p>

          <ul className="mt-4 space-y-2 text-sm">
            {lines.map(({ product, quantity }) => (
              <li key={product.id} className="flex flex-wrap justify-between gap-2">
                <span className="text-foreground">
                  {product.name[lang]}{" "}
                  <span className="text-muted">({product.sku})</span>
                </span>
                <span className="tabular-nums text-muted">
                  {quantity} × {formatPrice(product.price, lang) ?? cartDict.priceOnRequest}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-accent/30 pt-3 text-sm">
            <span className="text-muted">{cartDict.summaryPrice}</span>
            <span className="font-semibold text-foreground">
              {total > 0 ? formatPrice(total, lang) : cartDict.priceOnRequest}
            </span>
          </div>

          {unpriced > 0 ? (
            <p className="mt-2 text-xs text-accent-strong">
              {cartDict.unpricedNote.replace("{count}", String(unpriced))}
            </p>
          ) : null}

          <Link
            href={`/${lang}/cart`}
            className="mt-4 inline-block text-xs text-accent-strong transition-opacity hover:underline"
          >
            {dict.fromCartEdit}
          </Link>
        </section>
      ) : null}

      <QuoteForm
        dict={dict}
        initialProducts={summaryText}
        initialQuantity={lines.length > 0 ? String(totalQuantity(lines)) : ""}
        cartItems={lines.length > 0 ? toQuoteCartItems(lines, lang) : undefined}
      />
    </div>
  );
}
